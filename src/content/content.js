// Main Content Script for LinkedIn Job Assistant
class LinkedInJobAssistant {
  constructor() {
    try {
      // Check if extension context is valid before initialization
      if (!chrome.runtime?.id) {
        console.warn('Extension context invalidated. Content script will not initialize.');
        return;
      }

      this.parser = new LinkedInParser();
      this.isAnalyzing = false;
      this.currentJobData = null;
      this.contextValid = true;
      this.currentTheme = 'dark'; // Default to dark mode
      this.init();
    } catch (error) {
      console.error('Error initializing LinkedInJobAssistant:', error);
    }
  }

  init() {
    try {
      this.createFloatingButton();
      this.setupMessageHandlers();
      this.observePageChanges();
      this.setupContextValidator();
      this.initTheme();
      console.log('LinkedIn Job Assistant initialized successfully');
    } catch (error) {
      console.error('Error in content script initialization:', error);
    }
  }

  // Initialize theme system
  initTheme() {
    try {
      // Get theme from localStorage (set by popup/options)
      const savedTheme = localStorage.getItem('linkedin-assistant-theme');
      this.currentTheme = savedTheme || 'dark';

      // Listen for theme changes from other parts of the extension
      window.addEventListener('storage', (e) => {
        if (e.key === 'linkedin-assistant-theme' && e.newValue) {
          this.currentTheme = e.newValue;
          this.updateModalTheme();
        }
      });

      // Listen for BroadcastChannel theme updates
      if (typeof BroadcastChannel !== 'undefined') {
        this.themeChannel = new BroadcastChannel('theme-sync');
        this.themeChannel.addEventListener('message', (event) => {
          if (event.data.type === 'theme-change') {
            this.currentTheme = event.data.theme;
            this.updateModalTheme();
          }
        });
      }
    } catch (error) {
      console.error('Error initializing theme:', error);
      this.currentTheme = 'dark'; // Fallback to dark
    }
  }

  // Update modal theme when theme changes
  updateModalTheme() {
    const modal = document.getElementById('job-assistant-modal');
    if (modal) {
      modal.setAttribute('data-theme', this.currentTheme);
      // Apply theme class to document root for CSS variable inheritance
      document.documentElement.setAttribute('data-theme', this.currentTheme);
    }
  }

  // Setup context validator to detect when extension is reloaded
  setupContextValidator() {
    // Check context every 5 seconds
    this.contextChecker = setInterval(() => {
      if (!chrome.runtime?.id) {
        console.warn('Extension context lost. Cleaning up...');
        this.contextValid = false;
        this.cleanup();
      }
    }, 5000);
  }

  // Cleanup when extension context is lost
  cleanup() {
    try {
      if (this.contextChecker) {
        clearInterval(this.contextChecker);
      }

      // Close theme channel
      if (this.themeChannel) {
        this.themeChannel.close();
      }

      const button = document.getElementById('job-assistant-btn');
      if (button) {
        button.remove();
      }

      const modal = document.getElementById('job-assistant-modal');
      if (modal) {
        modal.remove();
      }

      // Show user notification about context loss
      this.showNotification('Extension was updated. Please reload the page for full functionality.', 'warning');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // Create floating action button
  createFloatingButton() {
    if (document.getElementById('job-assistant-btn')) return;

    const button = document.createElement('div');
    button.id = 'job-assistant-btn';
    button.innerHTML = `
      <div class="job-assistant-icon">🤖</div>
      <span class="job-assistant-text">Analyze Job</span>
    `;

    button.style.cssText = `
      position: fixed;
      top: 50%;
      right: 20px;
      transform: translateY(-50%);
      background: linear-gradient(135deg, #0077b5, #005582);
      color: white;
      padding: 12px 16px;
      border-radius: 25px;
      cursor: pointer;
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 119, 181, 0.3);
      transition: all 0.3s ease;
      min-width: 140px;
      justify-content: center;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-50%) scale(1.05)';
      button.style.boxShadow = '0 6px 20px rgba(0, 119, 181, 0.4)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(-50%) scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(0, 119, 181, 0.3)';
    });

    button.addEventListener('click', () => this.analyzeCurrentPage());

    document.body.appendChild(button);
  }

  // Analyze current page for job information
  async analyzeCurrentPage() {
    if (this.isAnalyzing) return;

    // Check if extension context is still valid
    if (!this.contextValid || !chrome.runtime?.id) {
      this.showNotification('Extension context lost. Please reload the page.', 'error');
      return;
    }

    const button = document.getElementById('job-assistant-btn');
    if (!button) {
      console.warn('Button not found, recreating...');
      this.createFloatingButton();
      return;
    }

    const originalText = button.querySelector('.job-assistant-text').textContent;

    try {
      this.isAnalyzing = true;
      this.updateButtonState('Analyzing...', '⏳');

      // Parse job data from current page
      const jobData = this.parser.autoDetectAndParse();

      if (!jobData || !jobData.isValid) {
        this.showNotification('No valid job post found on this page', 'warning');
        return;
      }

      this.currentJobData = jobData;

      // Send to background script for AI analysis
      const response = await this.sendToAI(jobData);

      if (response && response.success) {
        this.showAnalysisResults(response.data);
      } else {
        const errorMsg = response.error || 'Failed to analyze job post';
        this.showNotification(errorMsg, 'error');

        // If context invalidated, suggest page reload
        if (errorMsg.includes('Extension context invalidated')) {
          setTimeout(() => {
            this.showNotification('Please reload the page and try again.', 'warning');
          }, 2000);
        }
      }

    } catch (error) {
      console.error('Error analyzing page:', error);
      const errorMsg = error.message.includes('Extension context invalidated')
        ? 'Extension was updated. Please reload the page.'
        : 'Error analyzing job post';
      this.showNotification(errorMsg, 'error');
    } finally {
      this.isAnalyzing = false;
      this.updateButtonState(originalText, '🤖');
    }
  }

  // Send job data to AI backend
  async sendToAI(jobData) {
    return new Promise((resolve) => {
      try {
        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
          throw new Error('Extension context invalidated. Please reload the page.');
        }

        chrome.runtime.sendMessage({
          type: 'ANALYZE_JOB',
          data: jobData
        }, (response) => {
          // Check for runtime errors
          if (chrome.runtime.lastError) {
            console.error('Runtime error:', chrome.runtime.lastError);
            resolve({
              success: false,
              error: 'Extension context invalidated. Please reload the page.'
            });
            return;
          }

          resolve(response || { success: false, error: 'No response received' });
        });
      } catch (error) {
        console.error('Error sending message to background:', error);
        resolve({
          success: false,
          error: error.message || 'Extension context invalidated. Please reload the page.'
        });
      }
    });
  }

  // Update button state
  updateButtonState(text, icon) {
    const button = document.getElementById('job-assistant-btn');
    if (button) {
      button.querySelector('.job-assistant-text').textContent = text;
      button.querySelector('.job-assistant-icon').textContent = icon;
    }
  }

  // Show analysis results modal
  showAnalysisResults(analysisData) {
    // Debug: Log the analysis data to see what we're receiving
    console.log('🔍 Analysis Data Received:', analysisData);
    console.log('📄 Resume Skills Used:', analysisData.resume_skills_used);
    console.log('📊 Resume Skills Count:', analysisData.resume_skills_count);
    console.log('🎯 Relevant Resume Skills:', analysisData.relevant_resume_skills);

    // Remove existing modal
    const existingModal = document.getElementById('job-assistant-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'job-assistant-modal';
    modal.setAttribute('data-theme', this.currentTheme);
    modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Job Analysis Results</h3>
            <button class="close-btn" id="modal-close-btn">×</button>
          </div>
          <div class="modal-body">
            <div class="status-section">
              <div class="status-badge ${analysisData.status.toLowerCase()}">
                ${analysisData.status}
              </div>
              <p class="reason">${analysisData.reason}</p>
            </div>
            
            ${analysisData.status === 'RELEVANT' ? `
              <div class="contact-section">
                <h4>Contact Information</h4>
                <div class="contact-display">
                  <strong>Email:</strong> <span class="editable-contact" data-placeholder="Click to edit contact email">${analysisData.contact || 'Not found'}</span>
                </div>
              </div>
              
              ${analysisData.resume_skills_used === true && analysisData.relevant_resume_skills && analysisData.relevant_resume_skills.length > 0 ? `
                <div class="resume-skills-info">
                  <h4>📄 Resume Analysis</h4>
                  <p><strong>Resume Skills Used:</strong> Yes (${analysisData.resume_skills_count || 0} skills)</p>
                  <p><strong>Relevant Skills:</strong> ${analysisData.relevant_resume_skills.slice(0, 5).join(', ')}${analysisData.relevant_resume_skills.length > 5 ? '...' : ''}</p>
                  <small class="success-text">✨ Email generated using skills from your resume for better job matching</small>
                </div>
              ` : (analysisData.has_resume === false ? `
                <div class="resume-skills-info no-resume">
                  <p class="muted-text"><small>💡 Upload a resume in settings for more personalized applications</small></p>
                </div>
              ` : `
                <div class="resume-skills-info no-resume">
                  <p class="muted-text"><small>📄 Resume available but no matching skills found for this job</small></p>
                </div>
              `)}
              
              <div class="email-section">
                <h4>Generated Email</h4>
                <div class="email-preview">
                  <div class="subject-display">
                    <strong>Subject:</strong> <span class="editable-subject" data-placeholder="Click to edit subject">${analysisData.email_subject}</span>
                  </div>
                  <div class="body-display">
                    <strong>Message:</strong>
                    <div class="editable-body" data-placeholder="Click to edit email body">${analysisData.email_body.replace(/\n/g, '<br>')}</div>
                  </div>
                  <div class="edit-actions" style="display: none;">
                    <button class="btn-save-inline">💾 Save Changes</button>
                    <button class="btn-cancel-inline">❌ Cancel</button>
                  </div>
                </div>
              </div>
              
              <div class="action-buttons">
                <button class="btn-primary copy-email-btn" data-subject="${analysisData.email_subject}" data-body="${analysisData.email_body}">
                  📋 Copy Email
                </button>
                <button class="btn-secondary open-email-btn" data-email="${analysisData.contact}" data-subject="${analysisData.email_subject}" data-body="${analysisData.email_body}">
                  📧 Open Email Client
                </button>
                ${analysisData.contact ? `
                  <button class="btn-success send-email-btn" data-email="${analysisData.contact}" data-subject="${analysisData.email_subject}" data-body="${analysisData.email_body}">
                    🚀 Send Automatically
                  </button>
                ` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 100000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Minimal styles - rely on content.css for proper theming
    const styles = `
      <style>
        /* Basic modal positioning - let content.css handle theming */
        #job-assistant-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 100000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
      </style>
    `;

    modal.innerHTML = styles + modal.innerHTML;
    document.body.appendChild(modal);

    // Apply theme attribute for CSS variable inheritance
    document.documentElement.setAttribute('data-theme', this.currentTheme);

    // Add event listeners for modal interactions
    this.setupModalEventListeners(modal, analysisData);
  }

  // Setup event listeners for modal
  setupModalEventListeners(modal, analysisData) {
    // Close button
    const closeBtn = modal.querySelector('#modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.remove();
      });
    }

    // Close on backdrop click
    const backdrop = modal.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          modal.remove();
        }
      });
    }

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Copy email button
    const copyEmailBtn = modal.querySelector('.copy-email-btn');
    if (copyEmailBtn) {
      copyEmailBtn.addEventListener('click', () => {
        const subject = copyEmailBtn.dataset.subject;
        const body = copyEmailBtn.dataset.body;
        this.copyEmail(subject, body);
      });
    }

    // Setup inline editing for subject and body
    this.setupInlineEditing(modal, analysisData.contact);

    // Open email client button
    const openEmailBtn = modal.querySelector('.open-email-btn');
    if (openEmailBtn) {
      openEmailBtn.addEventListener('click', () => {
        const email = openEmailBtn.dataset.email;
        const subject = openEmailBtn.dataset.subject;
        const body = openEmailBtn.dataset.body;
        this.openEmailClient(email, subject, body);
      });
    }

    // Send email button
    const sendEmailBtn = modal.querySelector('.send-email-btn');
    if (sendEmailBtn) {
      sendEmailBtn.addEventListener('click', () => {
        const email = sendEmailBtn.dataset.email;
        const subject = sendEmailBtn.dataset.subject;
        const body = sendEmailBtn.dataset.body;
        this.sendEmail(email, subject, body);
      });
    }
  }

  // Copy email to clipboard
  copyEmail(subject, body) {
    const text = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(text).then(() => {
      this.showNotification('Email copied to clipboard!', 'success');
    });
  }

  // Open email client
  openEmailClient(email, subject, body) {
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
  }

  // Setup inline editing functionality
  setupInlineEditing(modal, emailAddress) {
    console.log('🔧 Setting up inline editing...');

    const editableSubject = modal.querySelector('.editable-subject');
    const editableBody = modal.querySelector('.editable-body');
    const editableContact = modal.querySelector('.editable-contact');
    const editActions = modal.querySelector('.edit-actions');
    const saveBtn = modal.querySelector('.btn-save-inline');
    const cancelBtn = modal.querySelector('.btn-cancel-inline');

    console.log('🔍 Found elements:', {
      editableSubject: !!editableSubject,
      editableBody: !!editableBody,
      editableContact: !!editableContact,
      editActions: !!editActions,
      saveBtn: !!saveBtn,
      cancelBtn: !!cancelBtn
    });

    if (!editableSubject || !editableBody || !editableContact || !editActions || !saveBtn || !cancelBtn) {
      console.error('❌ Missing required elements for inline editing');
      return;
    }

    let originalSubject = '';
    let originalBody = '';
    let originalContact = '';
    let isEditing = false;

    // Function to start editing subject
    const startSubjectEdit = () => {
      console.log('🎯 Subject edit clicked');
      if (isEditing) {
        console.log('❌ Already editing, aborting');
        return;
      }

      try {
        isEditing = true;
        originalSubject = editableSubject.textContent;
        console.log('📝 Original subject:', originalSubject);

        // Store original content and styling
        const originalDisplay = editableSubject.style.display || 'inline';
        const computedStyle = window.getComputedStyle(editableSubject);

        const input = document.createElement('input');
        input.className = 'editing-input';
        input.value = originalSubject;
        input.maxLength = 200;
        input.type = 'text';

        // Style the input to match the original element
        input.style.cssText = `
          width: ${Math.max(300, editableSubject.offsetWidth)}px;
          font-family: ${computedStyle.fontFamily};
          font-size: ${computedStyle.fontSize};
          font-weight: ${computedStyle.fontWeight};
          color: ${computedStyle.color};
          background: ${computedStyle.backgroundColor || 'transparent'};
          border: 1px solid #ccc;
          border-radius: 4px;
          padding: 4px 8px;
          outline: none;
          display: ${originalDisplay};
        `;

        console.log('💡 Creating input element with value:', input.value);

        // Replace the content inline
        editableSubject.innerHTML = '';
        editableSubject.appendChild(input);

        editActions.style.display = 'flex';
        input.focus();
        input.select();

        // Store reference for later access
        modal.currentEditInput = input;
        modal.originalSubjectDisplay = originalDisplay;
        console.log('✅ Subject edit mode activated');

      } catch (error) {
        console.error('❌ Error in subject editing:', error);
        isEditing = false;
      }
    };

    // Function to start editing body
    const startBodyEdit = () => {
      if (isEditing) return;

      isEditing = true;
      originalBody = editableBody.innerHTML.replace(/<br>/g, '\n');

      // Get the current dimensions of the body element
      const currentHeight = editableBody.offsetHeight;
      const computedStyle = window.getComputedStyle(editableBody);

      const textarea = document.createElement('textarea');
      textarea.className = 'editing-textarea';
      textarea.value = originalBody;
      textarea.maxLength = 2000;

      // Set the height to match the original element, with a reasonable minimum
      const targetHeight = Math.max(currentHeight, 80);
      textarea.style.height = `${targetHeight}px`;

      editableBody.style.display = 'none';
      editableBody.parentNode.insertBefore(textarea, editableBody.nextSibling);

      editActions.style.display = 'flex';
      textarea.focus();

      // Store reference for later access
      modal.currentEditTextarea = textarea;
    };

    // Function to start editing contact email
    const startContactEdit = () => {
      console.log('🎯 Contact edit clicked');
      if (isEditing) {
        console.log('❌ Already editing, aborting');
        return;
      }

      try {
        isEditing = true;
        originalContact = editableContact.textContent;
        console.log('📝 Original contact:', originalContact);

        // Store original content and styling
        const originalDisplay = editableContact.style.display || 'inline';
        const computedStyle = window.getComputedStyle(editableContact);

        const input = document.createElement('input');
        input.className = 'editing-input';
        input.value = originalContact;
        input.maxLength = 100;
        input.type = 'email';
        input.placeholder = 'Enter email address';

        // Style the input to match the original element
        input.style.cssText = `
          width: ${Math.max(250, editableContact.offsetWidth)}px;
          font-family: ${computedStyle.fontFamily};
          font-size: ${computedStyle.fontSize};
          font-weight: ${computedStyle.fontWeight};
          color: ${computedStyle.color};
          background: ${computedStyle.backgroundColor || 'transparent'};
          border: 1px solid #ccc;
          border-radius: 4px;
          padding: 4px 8px;
          outline: none;
          display: ${originalDisplay};
        `;

        console.log('💡 Creating contact input element with value:', input.value);

        // Replace the content inline
        editableContact.innerHTML = '';
        editableContact.appendChild(input);

        editActions.style.display = 'flex';
        input.focus();
        input.select();

        // Store reference for later access
        modal.currentEditContactInput = input;
        modal.originalContactDisplay = originalDisplay;
        console.log('✅ Contact edit mode activated');

      } catch (error) {
        console.error('❌ Error in contact editing:', error);
        isEditing = false;
      }
    };

    // Function to save changes
    const saveChanges = () => {
      console.log('💾 Save changes called');
      let newSubject = originalSubject;
      let newBody = originalBody;
      let newContact = originalContact;

      try {
        // Get new values
        if (modal.currentEditInput) {
          newSubject = modal.currentEditInput.value.trim();
          console.log('📝 New subject value:', newSubject);
          if (!newSubject) {
            this.showNotification('Subject cannot be empty', 'warning');
            return;
          }
        }

        if (modal.currentEditTextarea) {
          newBody = modal.currentEditTextarea.value.trim();
          console.log('📝 New body value:', newBody);
          if (!newBody) {
            this.showNotification('Email body cannot be empty', 'warning');
            return;
          }
        }

        if (modal.currentEditContactInput) {
          newContact = modal.currentEditContactInput.value.trim();
          console.log('📝 New contact value:', newContact);
          if (!newContact) {
            this.showNotification('Contact email cannot be empty', 'warning');
            return;
          }
        }

        // Update display
        if (modal.currentEditInput) {
          console.log('✅ Updating subject display');
          editableSubject.textContent = newSubject;
          // Restore original display style
          editableSubject.style.display = modal.originalSubjectDisplay || 'inline';
          modal.currentEditInput = null;
          modal.originalSubjectDisplay = null;
        }

        if (modal.currentEditTextarea) {
          console.log('✅ Updating body display');
          editableBody.innerHTML = newBody.replace(/\n/g, '<br>');
          modal.currentEditTextarea.remove();
          modal.currentEditTextarea = null;
          editableBody.style.display = 'block';
        }

        if (modal.currentEditContactInput) {
          console.log('✅ Updating contact display');
          editableContact.textContent = newContact;
          editableContact.style.display = modal.originalContactDisplay || 'inline';
          modal.currentEditContactInput = null;
          modal.originalContactDisplay = null;
        }

        // Update all button data attributes
        this.updateEmailContent(modal, newSubject, newBody, newContact);

        // Hide edit actions
        editActions.style.display = 'none';
        isEditing = false;

        this.showNotification('Email updated successfully!', 'success');
        console.log('✅ Save completed successfully');

      } catch (error) {
        console.error('❌ Error saving changes:', error);
        isEditing = false;
        editActions.style.display = 'none';
      }
    };

    // Function to cancel editing
    const cancelEditing = () => {
      console.log('❌ Cancel editing called');
      try {
        if (modal.currentEditInput) {
          console.log('🚫 Canceling subject edit');
          editableSubject.textContent = originalSubject;
          // Restore original display style
          editableSubject.style.display = modal.originalSubjectDisplay || 'inline';
          modal.currentEditInput = null;
          modal.originalSubjectDisplay = null;
        }

        if (modal.currentEditTextarea) {
          console.log('🚫 Canceling body edit');
          modal.currentEditTextarea.remove();
          modal.currentEditTextarea = null;
          editableBody.style.display = 'block';
        }

        if (modal.currentEditContactInput) {
          console.log('🚫 Canceling contact edit');
          editableContact.textContent = originalContact;
          editableContact.style.display = modal.originalContactDisplay || 'inline';
          modal.currentEditContactInput = null;
          modal.originalContactDisplay = null;
        }

        editActions.style.display = 'none';
        isEditing = false;
        console.log('✅ Cancel completed');
      } catch (error) {
        console.error('❌ Error canceling edit:', error);
        isEditing = false;
        editActions.style.display = 'none';
      }
    };

    // Event listeners
    if (editableSubject) {
      editableSubject.addEventListener('click', startSubjectEdit);
      console.log('✅ Subject click listener added');
    } else {
      console.warn('❌ editableSubject element not found');
    }

    if (editableBody) {
      editableBody.addEventListener('click', startBodyEdit);
      console.log('✅ Body click listener added');
    } else {
      console.warn('❌ editableBody element not found');
    }

    if (editableContact) {
      editableContact.addEventListener('click', startContactEdit);
      console.log('✅ Contact click listener added');
    } else {
      console.warn('❌ editableContact element not found');
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', saveChanges);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelEditing);
    }

    // Handle Enter key for subject/contact input and Escape for cancel
    modal.addEventListener('keydown', (e) => {
      if (isEditing) {
        if (e.key === 'Enter' && (modal.currentEditInput || modal.currentEditContactInput)) {
          e.preventDefault();
          saveChanges();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelEditing();
        }
      }
    });
  }

  // Send email automatically
  async sendEmail(email, subject, body) {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        throw new Error('Extension context invalidated. Please reload the page.');
      }

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'SEND_EMAIL',
          data: { email, subject, body }
        }, (response) => {
          // Check for runtime errors
          if (chrome.runtime.lastError) {
            console.error('Runtime error:', chrome.runtime.lastError);
            resolve({
              success: false,
              error: 'Extension context invalidated. Please reload the page.'
            });
            return;
          }

          resolve(response || { success: false, error: 'No response received' });
        });
      });

      if (response && response.success) {
        this.showNotification('Email sent successfully!', 'success');
        document.getElementById('job-assistant-modal').remove();
      } else {
        this.showNotification(response.error || 'Failed to send email', 'error');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      this.showNotification(error.message || 'Error sending email', 'error');
    }
  }

  // Update email content in the main modal  
  updateEmailContent(modal, newSubject, newBody, newContact) {
    // Update all button data attributes
    const buttons = modal.querySelectorAll('.copy-email-btn, .open-email-btn, .send-email-btn');
    buttons.forEach(button => {
      button.dataset.subject = newSubject;
      button.dataset.body = newBody;
      if (newContact) {
        button.dataset.email = newContact;
      }
    });
  }

  // Escape HTML to prevent XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Show notification
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#0077b5'};
      color: ${type === 'warning' ? '#000' : '#fff'};
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 100001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      animation: slideIn 0.3s ease;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Setup message handlers for communication with background script
  setupMessageHandlers() {
    try {
      // Check if extension context is valid
      if (!chrome.runtime?.id) {
        console.warn('Extension context invalidated during setup');
        return;
      }

      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
          if (!message || !message.type) {
            sendResponse({ success: false, error: 'Invalid message format' });
            return false;
          }

          switch (message.type) {
            case 'GET_PAGE_DATA':
              const jobData = this.parser.autoDetectAndParse();
              sendResponse({ data: jobData });
              break;

            case 'GET_BULK_JOB_DATA':
              this.getBulkJobData(message.limit || 10, message.autoLoadMore || false, message.enhancedFilter || false)
                .then(data => sendResponse({ success: true, data }))
                .catch(error => {
                  console.error('Error getting bulk job data:', error);
                  sendResponse({ success: false, error: error.message });
                });
              return true; // Keep channel open for async response

            case 'ANALYZE_TRIGGERED':
              this.analyzeCurrentPage();
              sendResponse({ success: true });
              break;

            default:
              sendResponse({ success: false, error: 'Unknown message type' });
              break;
          }
        } catch (error) {
          console.error('Error in message handler:', error);
          sendResponse({ success: false, error: error.message });
        }

        return false; // Don't keep channel open
      });
    } catch (error) {
      console.error('Error setting up message handlers:', error);
    }
  }

  // Observe page changes (for SPA navigation)
  observePageChanges() {
    let currentUrl = window.location.href;

    const observer = new MutationObserver(() => {
      if (currentUrl !== window.location.href) {
        currentUrl = window.location.href;
        // Recreate button after navigation
        setTimeout(() => this.createFloatingButton(), 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Get bulk job data from current page
  async getBulkJobData(limit = 10, autoLoadMore = false, enhancedFilter = false) {
    const jobs = [];

    try {
      // Check if we're on a LinkedIn page
      if (!window.location.href.includes('linkedin.com')) {
        throw new Error('Not on a LinkedIn page');
      }

      console.log(`📊 Starting bulk extraction: limit=${limit}, autoLoad=${autoLoadMore}, enhanced=${enhancedFilter}`);

      // Method 1: Extract from job search results page
      if (window.location.href.includes('/jobs/search/') || window.location.href.includes('/jobs/collections/')) {
        await this.extractFromJobSearchPage(jobs, limit, autoLoadMore, enhancedFilter);
      }

      // Method 2: Extract from LinkedIn feed posts
      else if (window.location.href.includes('/feed/') || window.location.pathname === '/') {
        await this.extractFromFeedPage(jobs, limit, autoLoadMore, enhancedFilter);
      }

      // Method 3: If on a specific job page, get recommended/similar jobs
      else if (window.location.href.includes('/jobs/view/')) {
        await this.extractFromJobViewPage(jobs, limit, autoLoadMore, enhancedFilter);
      }

      console.log(`📊 Extracted ${jobs.length} job posts from page`);
      return jobs;

    } catch (error) {
      console.error('Error extracting bulk job data:', error);
      throw error;
    }
  }

  // Extract jobs from job search results page
  async extractFromJobSearchPage(jobs, limit, autoLoadMore, enhancedFilter) {
    let attempts = 0;
    const maxAttempts = autoLoadMore ? 5 : 1;

    while (jobs.length < limit && attempts < maxAttempts) {
      const jobCards = document.querySelectorAll('.job-search-card, .jobs-search-results__list-item, .scaffold-layout__list-item');

      // Extract from current visible cards
      for (let i = jobs.length; i < Math.min(jobCards.length, limit); i++) {
        const card = jobCards[i];
        const jobData = this.extractJobFromCard(card, i);
        if (jobData && jobData.isValid) {
          // Apply enhanced filtering if enabled
          if (!enhancedFilter || this.passesEnhancedFilter(jobData)) {
            jobs.push(jobData);
          }
        }
      }

      // If we need more jobs and auto-loading is enabled, try to load more
      if (jobs.length < limit && autoLoadMore && attempts < maxAttempts - 1) {
        console.log(`📄 Need more jobs (${jobs.length}/${limit}), attempting to load more...`);
        await this.loadMoreJobs();
        attempts++;
        await this.delay(2000); // Wait for new content to load
      } else {
        break;
      }
    }
  }

  // Extract jobs from LinkedIn feed
  async extractFromFeedPage(jobs, limit, autoLoadMore, enhancedFilter) {
    let attempts = 0;
    const maxAttempts = autoLoadMore ? 5 : 1;

    while (jobs.length < limit && attempts < maxAttempts) {
      const feedPosts = document.querySelectorAll('.feed-shared-update-v2, .update-v2-social-activity, .feed-shared-mini-update-v2');

      for (let i = 0; i < feedPosts.length && jobs.length < limit; i++) {
        const post = feedPosts[i];
        const jobData = this.extractJobFromFeedPost(post, i);
        if (jobData && jobData.isValid) {
          // Apply enhanced filtering if enabled
          if (!enhancedFilter || this.passesEnhancedFilter(jobData)) {
            jobs.push(jobData);
          }
        }
      }

      // Load more feed content if needed
      if (jobs.length < limit && autoLoadMore && attempts < maxAttempts - 1) {
        console.log(`📄 Need more job posts from feed (${jobs.length}/${limit}), scrolling for more...`);
        await this.scrollForMoreContent();
        attempts++;
        await this.delay(3000); // Wait for new content to load
      } else {
        break;
      }
    }
  }

  // Extract jobs from individual job view page
  async extractFromJobViewPage(jobs, limit, autoLoadMore, enhancedFilter) {
    // Get the current job first
    const currentJob = this.parser.parseJobPage();
    if (currentJob && currentJob.isValid) {
      if (!enhancedFilter || this.passesEnhancedFilter(currentJob)) {
        jobs.push(currentJob);
      }
    }

    // Look for similar/recommended jobs on the same page
    const similarJobs = document.querySelectorAll('.jobs-similar-jobs__card, .job-card-container, .jobs-details__right-rail .job-card');

    for (let i = 0; i < Math.min(similarJobs.length, limit - jobs.length); i++) {
      const card = similarJobs[i];
      const jobData = this.extractJobFromCard(card, i);
      if (jobData && jobData.isValid) {
        if (!enhancedFilter || this.passesEnhancedFilter(jobData)) {
          jobs.push(jobData);
        }
      }
    }
  }

  // Enhanced filtering based on job content
  passesEnhancedFilter(jobData) {
    // More sophisticated keyword matching
    const content = `${jobData.title || ''} ${jobData.company || ''} ${jobData.description || ''} ${jobData.content || ''}`.toLowerCase();

    // Skip clearly irrelevant posts
    const irrelevantKeywords = [
      'internship', 'intern', 'entry level', 'student', 'graduate program',
      'sales rep', 'marketing manager', 'hr manager', 'accountant',
      'administrative', 'receptionist', 'customer service',
      'retail', 'restaurant', 'warehouse', 'delivery driver'
    ];

    // Check for irrelevant keywords
    const hasIrrelevantKeywords = irrelevantKeywords.some(keyword => content.includes(keyword));
    if (hasIrrelevantKeywords) {
      console.log(`� Filtered out job with irrelevant keywords: ${jobData.title}`);
      return false;
    }

    // Enhanced job keyword matching
    const techKeywords = [
      'developer', 'engineer', 'programmer', 'architect', 'analyst',
      'python', 'javascript', 'java', 'react', 'node.js', 'api',
      'backend', 'frontend', 'fullstack', 'full-stack', 'ml', 'ai',
      'machine learning', 'data science', 'devops', 'cloud',
      'software', 'technical', 'technology', 'coding', 'programming'
    ];

    const hasTechKeywords = techKeywords.some(keyword => content.includes(keyword));

    if (!hasTechKeywords && jobData.type === 'feed_post') {
      // For feed posts, be more strict about tech keywords
      console.log(`🚫 Filtered out non-tech feed post: ${jobData.title || jobData.content?.substring(0, 50)}`);
      return false;
    }

    return true;
  }

  // Attempt to load more jobs by scrolling or clicking load more button
  async loadMoreJobs() {
    try {
      // Method 1: Look for "Load more" or "Show more" buttons
      const loadMoreButtons = document.querySelectorAll([
        'button[aria-label*="more"]',
        'button[aria-label*="More"]',
        'button[data-control-name*="load_more"]',
        '.jobs-search-results__pagination button',
        '.artdeco-pagination__button--next'
      ].join(', '));

      for (const button of loadMoreButtons) {
        if (button.textContent.toLowerCase().includes('more') ||
          button.textContent.toLowerCase().includes('next') ||
          button.getAttribute('aria-label')?.toLowerCase().includes('more')) {
          console.log('📄 Clicking load more button:', button.textContent);
          button.click();
          return true;
        }
      }

      // Method 2: Scroll to bottom to trigger infinite scroll
      const initialHeight = document.body.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);

      // Wait a bit and check if new content loaded
      await this.delay(1000);
      const newHeight = document.body.scrollHeight;

      if (newHeight > initialHeight) {
        console.log('📄 Successfully triggered scroll loading');
        return true;
      }

      console.log('📄 No additional content could be loaded');
      return false;
    } catch (error) {
      console.error('Error loading more jobs:', error);
      return false;
    }
  }

  // Scroll for more content in feed
  async scrollForMoreContent() {
    try {
      const initialPosts = document.querySelectorAll('.feed-shared-update-v2').length;

      // Scroll to bottom multiple times
      for (let i = 0; i < 3; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await this.delay(1000);
      }

      const newPosts = document.querySelectorAll('.feed-shared-update-v2').length;
      console.log(`📄 Feed scroll result: ${initialPosts} -> ${newPosts} posts`);

      return newPosts > initialPosts;
    } catch (error) {
      console.error('Error scrolling for more content:', error);
      return false;
    }
  }

  // Utility delay function
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Extract job data from a job card element
  extractJobFromCard(card, index) {
    try {
      const titleElement = card.querySelector('.job-card-list__title, .job-card-container__link, .base-search-card__title, .job-card-list__title-link, h3 a, .job-card-list__title strong');
      const companyElement = card.querySelector('.job-card-container__primary-description, .base-search-card__subtitle, .job-card-list__company, .artdeco-entity-lockup__subtitle, h4 a');
      const locationElement = card.querySelector('.job-card-container__metadata-item, .job-card-list__metadata, .artdeco-entity-lockup__caption');
      const linkElement = card.querySelector('a[href*="/jobs/view/"], a[href*="/jobs/collections/"]') || titleElement;

      const title = titleElement?.textContent?.trim() || '';
      const company = companyElement?.textContent?.trim() || '';
      const location = locationElement?.textContent?.trim() || '';
      const jobUrl = linkElement?.href || window.location.href;

      // Try to get job description if available
      const descriptionElement = card.querySelector('.job-card-list__description, .base-search-card__content');
      const description = descriptionElement?.textContent?.trim() || '';

      const jobData = {
        type: 'job_card',
        title,
        company,
        location,
        description,
        url: jobUrl,
        source: 'bulk_extraction',
        index,
        timestamp: new Date().toISOString(),
        contactInfo: this.parser.extractContactInfo(card)
      };

      // Clean and validate
      return this.parser.cleanJobData(jobData);

    } catch (error) {
      console.error('Error extracting job from card:', error);
      return null;
    }
  }

  // Extract job data from a LinkedIn feed post
  extractJobFromFeedPost(post, index) {
    try {
      const contentElement = post.querySelector('.feed-shared-update-v2__description, .update-components-text, .feed-shared-text');
      const authorElement = post.querySelector('.update-components-actor__name, .feed-shared-actor__name');
      const companyElement = post.querySelector('.update-components-actor__description, .feed-shared-actor__description');

      const content = contentElement?.textContent?.trim() || '';
      const author = authorElement?.textContent?.trim() || '';
      const company = companyElement?.textContent?.trim() || author;

      // Check if this post contains job-related keywords
      if (!this.parser.containsJobKeywords(content)) {
        return null;
      }

      const jobData = {
        type: 'feed_post',
        content,
        title: this.extractJobTitleFromPost(content),
        company,
        author,
        url: window.location.href,
        source: 'bulk_extraction',
        index,
        timestamp: new Date().toISOString(),
        contactInfo: this.parser.extractContactInfo(post)
      };

      // Clean and validate
      const cleanedData = this.parser.cleanJobData(jobData);

      // Override validation for feed posts - they're valid if they have content
      if (cleanedData.content && cleanedData.content.length > 50) {
        cleanedData.isValid = true;
      }

      return cleanedData;

    } catch (error) {
      console.error('Error extracting job from feed post:', error);
      return null;
    }
  }

  // Extract potential job title from post content
  extractJobTitleFromPost(content) {
    const jobTitlePatterns = [
      /(?:hiring|looking for|seeking|recruiting)(?:\s+a)?\s+([A-Za-z\s]{5,50})(?:\s+at|$|\.|,)/i,
      /(?:position|role|job)(?:\s+for)?\s+([A-Za-z\s]{5,50})(?:\s+at|$|\.|,)/i,
      /([A-Za-z\s]{5,50})\s+(?:developer|engineer|manager|analyst|specialist|coordinator)/i
    ];

    for (const pattern of jobTitlePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return 'Job Opportunity';
  }
}

// Initialize when page loads
try {
  // Check if extension context is valid before initialization
  if (!chrome.runtime?.id) {
    console.warn('Extension context invalidated. LinkedIn Job Assistant will not initialize.');
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        try {
          window.jobAssistant = new LinkedInJobAssistant();
        } catch (error) {
          console.error('Error initializing LinkedIn Job Assistant on DOMContentLoaded:', error);
        }
      });
    } else {
      window.jobAssistant = new LinkedInJobAssistant();
    }
  }
} catch (error) {
  console.error('Error during LinkedIn Job Assistant initialization:', error);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);