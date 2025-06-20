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
      console.log('LinkedIn Job Assistant initialized successfully');
    } catch (error) {
      console.error('Error in content script initialization:', error);
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
    // Remove existing modal
    const existingModal = document.getElementById('job-assistant-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'job-assistant-modal';
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
                <p><strong>Email:</strong> ${analysisData.contact || 'Not found'}</p>
              </div>
              
              <div class="email-section">
                <h4>Generated Email</h4>
                <div class="email-preview">
                  <p><strong>Subject:</strong> ${analysisData.email_subject}</p>
                  <div class="email-body">
                    ${analysisData.email_body.replace(/\n/g, '<br>')}
                  </div>
                </div>
              </div>
              
              <div class="action-buttons">
                <button class="btn-primary copy-email-btn" data-subject="${analysisData.email_subject}" data-body="${analysisData.email_body}">
                  Copy Email
                </button>
                <button class="btn-secondary open-email-btn" data-email="${analysisData.contact}" data-subject="${analysisData.email_subject}" data-body="${analysisData.email_body}">
                  Open Email Client
                </button>
                ${analysisData.contact ? `
                  <button class="btn-success send-email-btn" data-email="${analysisData.contact}" data-subject="${analysisData.email_subject}" data-body="${analysisData.email_body}">
                    Send Automatically
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

    // Add styles
    const styles = `
      <style>
        #job-assistant-modal .modal-backdrop {
          background: rgba(0, 0, 0, 0.5);
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        
        #job-assistant-modal .modal-content {
          background: white;
          border-radius: 12px;
          max-width: 600px;
          width: 100%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        
        #job-assistant-modal .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #eee;
        }
        
        #job-assistant-modal .modal-header h3 {
          margin: 0;
          color: #333;
        }
        
        #job-assistant-modal .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #999;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        
        #job-assistant-modal .close-btn:hover {
          background: #f0f0f0;
          color: #333;
        }
        
        #job-assistant-modal .modal-body {
          padding: 20px;
        }
        
        #job-assistant-modal .status-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 20px;
          font-weight: 500;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        
        #job-assistant-modal .status-badge.relevant {
          background: #d4edda;
          color: #155724;
        }
        
        #job-assistant-modal .status-badge.not.relevant {
          background: #f8d7da;
          color: #721c24;
        }
        
        #job-assistant-modal .email-preview {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin: 10px 0;
        }
        
        #job-assistant-modal .email-body {
          margin-top: 10px;
          line-height: 1.5;
        }
        
        #job-assistant-modal .action-buttons {
          display: flex;
          gap: 10px;
          margin-top: 20px;
          flex-wrap: wrap;
        }
        
        #job-assistant-modal .action-buttons button {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        
        #job-assistant-modal .btn-primary {
          background: #0077b5;
          color: white;
        }
        
        #job-assistant-modal .btn-secondary {
          background: #6c757d;
          color: white;
        }
        
        #job-assistant-modal .btn-success {
          background: #28a745;
          color: white;
        }
        
        #job-assistant-modal .action-buttons button:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
      </style>
    `;

    modal.innerHTML = styles + modal.innerHTML;
    document.body.appendChild(modal);

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