// Main Content Script for LinkedIn Job Assistant
class LinkedInJobAssistant {
    constructor() {
        this.parser = new LinkedInParser();
        this.isAnalyzing = false;
        this.currentJobData = null;
        this.init();
    }

    init() {
        this.createFloatingButton();
        this.setupMessageHandlers();
        this.observePageChanges();
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

        const button = document.getElementById('job-assistant-btn');
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
                this.showNotification('Failed to analyze job post', 'error');
            }

        } catch (error) {
            console.error('Error analyzing page:', error);
            this.showNotification('Error analyzing job post', 'error');
        } finally {
            this.isAnalyzing = false;
            this.updateButtonState(originalText, '🤖');
        }
    }

    // Send job data to AI backend
    async sendToAI(jobData) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'ANALYZE_JOB',
                data: jobData
            }, (response) => {
                resolve(response);
            });
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
            <button class="close-btn" onclick="this.closest('#job-assistant-modal').remove()">×</button>
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
                <button class="btn-primary" onclick="window.jobAssistant.copyEmail('${analysisData.email_subject}', \`${analysisData.email_body}\`)">
                  Copy Email
                </button>
                <button class="btn-secondary" onclick="window.jobAssistant.openEmailClient('${analysisData.contact}', '${analysisData.email_subject}', \`${analysisData.email_body}\`)">
                  Open Email Client
                </button>
                ${analysisData.contact ? `
                  <button class="btn-success" onclick="window.jobAssistant.sendEmail('${analysisData.contact}', '${analysisData.email_subject}', \`${analysisData.email_body}\`)">
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
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'SEND_EMAIL',
                    data: { email, subject, body }
                }, resolve);
            });

            if (response && response.success) {
                this.showNotification('Email sent successfully!', 'success');
                document.getElementById('job-assistant-modal').remove();
            } else {
                this.showNotification('Failed to send email', 'error');
            }
        } catch (error) {
            console.error('Error sending email:', error);
            this.showNotification('Error sending email', 'error');
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
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'GET_PAGE_DATA':
                    const jobData = this.parser.autoDetectAndParse();
                    sendResponse({ data: jobData });
                    break;

                case 'ANALYZE_TRIGGERED':
                    this.analyzeCurrentPage();
                    break;
            }
        });
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
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.jobAssistant = new LinkedInJobAssistant();
    });
} else {
    window.jobAssistant = new LinkedInJobAssistant();
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