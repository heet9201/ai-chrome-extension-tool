// Popup Script for LinkedIn Job Assistant
// Import configuration and design system
import('../utils/config.js').then(module => {
    if (module.default) {
        window.Config = module.default;
        console.log('Design system loaded:', Config.DESIGN);
        Config.logConfig();
    }
}).catch(err => {
    console.warn('Config module not available, using fallback');
});

class PopupController {
    constructor() {
        this.currentJobData = null;
        this.currentAnalysis = null;
        this.stats = { analyzed: 0, relevant: 0, applied: 0 };
        this.init();
    }

    async init() {
        await this.loadStats();
        this.setupEventListeners();
        this.setupEmailEditing();
        this.updateUI();
        this.checkCurrentPage();
        this.initializeDesignSystem();
        this.initializeTheme();
    }

    // Initialize design system features
    initializeDesignSystem() {
        // Add smooth transitions to all elements
        document.body.style.setProperty('--transition-duration', '300ms');
    }

    // Initialize theme system
    initializeTheme() {
        // Wait for config to be available
        const initThemeWithConfig = () => {
            if (window.Config) {
                // Initialize theme from config
                window.Config.initTheme();

                // Update theme toggle icon immediately
                this.updateThemeToggleIcon();

                // Listen for theme changes (including cross-tab sync)
                window.addEventListener('themeChanged', (e) => {
                    console.log('Popup: Theme changed to:', e.detail.theme, 'Source:', e.detail.source || 'local');
                    this.updateThemeToggleIcon();
                });

                // Setup theme toggle button
                const themeToggle = document.getElementById('themeToggle');
                if (themeToggle) {
                    themeToggle.addEventListener('click', () => {
                        if (window.Config) {
                            const newTheme = window.Config.toggleTheme();
                            console.log('Popup: Toggled to theme:', newTheme);

                            // Add a subtle animation feedback
                            themeToggle.style.transform = 'scale(0.9)';
                            setTimeout(() => {
                                themeToggle.style.transform = '';
                            }, 150);
                        }
                    });
                }
            } else {
                // Config not ready yet, wait a bit
                setTimeout(initThemeWithConfig, 100);
            }
        };

        initThemeWithConfig();
    }

    // Update theme toggle icon based on current theme
    updateThemeToggleIcon() {
        const themeToggleIcon = document.querySelector('.theme-toggle-icon');
        if (themeToggleIcon && window.Config) {
            const currentTheme = window.Config.getTheme();
            // Clear any existing content first to prevent duplication
            themeToggleIcon.textContent = '';
            // Show sun icon when in dark mode (to switch to light), moon when in light mode (to switch to dark)
            themeToggleIcon.textContent = currentTheme === 'dark' ? '☀️' : '🌙';

            // Update title attribute for better UX
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.title = currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
            }

            console.log('Popup theme icon updated to:', themeToggleIcon.textContent, 'for theme:', currentTheme);
        } else if (!themeToggleIcon) {
            // If icon element is not ready yet, try again in a moment
            setTimeout(() => this.updateThemeToggleIcon(), 50);
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Main action buttons
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeJob());
        document.getElementById('quickApplyBtn').addEventListener('click', () => this.quickApply());

        // Result action buttons
        document.getElementById('copyEmailBtn').addEventListener('click', () => this.copyEmail());
        document.getElementById('openEmailBtn').addEventListener('click', () => this.openEmailClient());
        document.getElementById('sendEmailBtn').addEventListener('click', () => this.sendEmail());

        // Navigation buttons
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('openOptionsBtn').addEventListener('click', () => this.openOptions());
        document.getElementById('helpBtn').addEventListener('click', () => this.showHelp());

        // Notification close
        document.getElementById('notificationClose').addEventListener('click', () => this.hideNotification());

        // Email editing save/cancel buttons
        document.getElementById('saveEmailBtn').addEventListener('click', () => this.saveEmailChanges());
        document.getElementById('cancelEmailBtn').addEventListener('click', () => this.cancelEmailEditing());
    }

    // Check if current page is LinkedIn and update status
    async checkCurrentPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('linkedin.com')) {
                this.updateStatus('❌', 'Not on LinkedIn', 'Please navigate to LinkedIn to use this extension');
                document.getElementById('analyzeBtn').disabled = true;
                return;
            }

            // Get page data from content script
            chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_DATA' }, (response) => {
                if (chrome.runtime.lastError) {
                    this.updateStatus('⚠️', 'Page Loading', 'Refresh the page if this persists');
                    return;
                }

                if (response && response.data && response.data.isValid) {
                    this.currentJobData = response.data;
                    this.updateStatus('✅', 'Job Post Detected', 'Ready to analyze this job posting');
                    document.getElementById('analyzeBtn').disabled = false;
                } else {
                    this.updateStatus('📄', 'Looking for Jobs', 'No job post detected on current page');
                    document.getElementById('analyzeBtn').disabled = true;
                }
            });

        } catch (error) {
            console.error('Error checking current page:', error);
            this.updateStatus('❌', 'Error', 'Failed to check current page');
        }
    }

    // Update status display
    updateStatus(icon, title, description) {
        document.getElementById('statusIcon').textContent = icon;
        document.getElementById('statusTitle').textContent = title;
        document.getElementById('statusDescription').textContent = description;
    }

    // Analyze current job
    async analyzeJob() {
        if (!this.currentJobData) {
            this.showNotification('No job data found. Please refresh the page.', 'error');
            return;
        }

        this.showLoading('Analyzing job post...');

        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'ANALYZE_JOB',
                    data: this.currentJobData
                }, resolve);
            });

            if (response && response.success) {
                this.currentAnalysis = response.data;
                this.displayAnalysisResults(response.data);
                this.updateStats('analyzed');

                if (response.data.status === 'RELEVANT') {
                    this.updateStats('relevant');
                }
            } else {
                throw new Error(response?.error || 'Analysis failed');
            }

        } catch (error) {
            console.error('Error analyzing job:', error);
            this.showNotification('Failed to analyze job. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Display analysis results
    displayAnalysisResults(analysis) {
        const resultsSection = document.getElementById('resultsSection');
        const relevanceStatus = document.getElementById('relevanceStatus');
        const analysisReason = document.getElementById('analysisReason');
        const contactInfo = document.getElementById('contactInfo');
        const contactEmail = document.getElementById('contactEmail');
        const emailPreview = document.getElementById('emailPreview');
        const emailSubject = document.getElementById('emailSubject');
        const emailBody = document.getElementById('emailBody');
        const actionButtons = document.getElementById('actionButtons');

        // Show results section
        resultsSection.style.display = 'block';

        // Update relevance status
        relevanceStatus.textContent = analysis.status;
        relevanceStatus.className = `status-badge ${analysis.status.toLowerCase().replace(' ', '-')}`;

        // Update reason
        analysisReason.textContent = analysis.reason;

        if (analysis.status === 'RELEVANT') {
            // Show contact info if available
            if (analysis.contact) {
                contactEmail.textContent = analysis.contact;
                contactInfo.style.display = 'block';
            } else {
                contactInfo.style.display = 'none';
            }

            // Show email preview
            emailSubject.textContent = analysis.email_subject;
            emailBody.innerHTML = analysis.email_body.replace(/\n/g, '<br>');
            emailPreview.style.display = 'block';
            actionButtons.style.display = 'block';

            // Enable quick apply button
            document.getElementById('quickApplyBtn').disabled = false;

            this.updateStatus('✅', 'Job is Relevant!', 'This job matches your profile');
        } else {
            // Hide email-related sections for non-relevant jobs
            contactInfo.style.display = 'none';
            emailPreview.style.display = 'none';
            actionButtons.style.display = 'none';

            this.updateStatus('❌', 'Job Not Relevant', 'This job doesn\'t match your profile');
        }
    }

    // Quick apply (same as copy email for now)
    quickApply() {
        if (this.currentAnalysis && this.currentAnalysis.status === 'RELEVANT') {
            this.copyEmail();
        }
    }

    // Copy email to clipboard
    async copyEmail() {
        if (!this.currentAnalysis) return;

        const emailText = `Subject: ${this.currentAnalysis.email_subject}\n\n${this.currentAnalysis.email_body}`;

        try {
            await navigator.clipboard.writeText(emailText);
            this.showNotification('Email copied to clipboard!', 'success');
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            this.showNotification('Failed to copy email', 'error');
        }
    }

    // Open email client
    openEmailClient() {
        if (!this.currentAnalysis) return;

        const mailtoUrl = `mailto:${this.currentAnalysis.contact || ''}?subject=${encodeURIComponent(this.currentAnalysis.email_subject)}&body=${encodeURIComponent(this.currentAnalysis.email_body)}`;

        chrome.tabs.create({ url: mailtoUrl });
    }

    // Send email automatically
    async sendEmail() {
        if (!this.currentAnalysis || !this.currentAnalysis.contact) {
            this.showNotification('No contact email found', 'error');
            return;
        }

        this.showLoading('Sending email...');

        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'SEND_EMAIL',
                    data: {
                        email: this.currentAnalysis.contact,
                        subject: this.currentAnalysis.email_subject,
                        body: this.currentAnalysis.email_body
                    }
                }, resolve);
            });

            if (response && response.success) {
                this.showNotification('Email sent successfully!', 'success');
                this.updateStats('applied');
            } else {
                throw new Error(response?.error || 'Failed to send email');
            }

        } catch (error) {
            console.error('Error sending email:', error);
            this.showNotification('Failed to send email', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Update and save stats
    async updateStats(type) {
        this.stats[type]++;
        await chrome.storage.local.set({ stats: this.stats });
        this.updateStatsDisplay();
    }

    // Load stats from storage
    async loadStats() {
        try {
            const result = await chrome.storage.local.get(['stats']);
            this.stats = result.stats || { analyzed: 0, relevant: 0, applied: 0 };
            this.updateStatsDisplay();
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    // Update stats display
    updateStatsDisplay() {
        document.getElementById('analyzedCount').textContent = this.stats.analyzed;
        document.getElementById('relevantCount').textContent = this.stats.relevant;
        document.getElementById('appliedCount').textContent = this.stats.applied;
    }

    // Show loading overlay
    showLoading(text = 'Loading...') {
        document.getElementById('loadingText').textContent = text;
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    // Hide loading overlay
    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');

        notificationText.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'flex';

        // Auto-hide after 3 seconds
        setTimeout(() => this.hideNotification(), 3000);
    }

    // Hide notification
    hideNotification() {
        const notification = document.getElementById('notification');
        if (notification) {
            // Add hide animation class
            notification.classList.add('hide');

            // Wait for animation to complete before hiding
            setTimeout(() => {
                notification.style.display = 'none';
                notification.className = 'notification';
            }, 300); // Match animation duration
        }
    }

    // Open settings
    openSettings() {
        // For now, same as options
        this.openOptions();
    }

    // Open options page
    openOptions() {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html') });
    }

    // Show help
    showHelp() {
        const helpText = `LinkedIn Job Assistant Help:

1. Navigate to a LinkedIn job post or feed
2. Click "Analyze Job Post" to check relevance
3. Review the AI analysis results
4. Use "Copy Email" or "Send Automatically" to apply

Features:
• AI-powered job relevance checking
• Automatic email generation
• One-click application process
• Profile customization in settings

Tips:
• Make sure you're on LinkedIn for the extension to work
• Update your profile in settings for better results
• Use the floating button on LinkedIn pages for quick access`;

        this.showNotification(helpText, 'info');
    }

    // Setup email editing functionality
    setupEmailEditing() {
        const editableSubject = document.getElementById('emailSubject');
        const editableBody = document.getElementById('emailBody');
        const editActions = document.querySelector('.edit-actions');

        if (!editableSubject || !editableBody || !editActions) {
            console.warn('Email editing elements not found');
            return;
        }

        this.emailEditState = {
            isEditing: false,
            originalSubject: '',
            originalBody: '',
            currentEditInput: null,
            currentEditTextarea: null
        };

        // Subject editing
        editableSubject.addEventListener('click', () => this.startSubjectEdit());

        // Body editing
        editableBody.addEventListener('click', () => this.startBodyEdit());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.emailEditState.isEditing) {
                if (e.key === 'Enter' && this.emailEditState.currentEditInput) {
                    e.preventDefault();
                    this.saveEmailChanges();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelEmailEditing();
                }
            }
        });
    }

    // Start editing subject
    startSubjectEdit() {
        if (this.emailEditState.isEditing || !this.currentAnalysis) return;

        const editableSubject = document.getElementById('emailSubject');
        const editActions = document.querySelector('.edit-actions');

        this.emailEditState.isEditing = true;
        this.emailEditState.originalSubject = editableSubject.textContent;

        const computedStyle = window.getComputedStyle(editableSubject);

        const input = document.createElement('input');
        input.className = 'editing-input';
        input.value = this.emailEditState.originalSubject;
        input.maxLength = 200;
        input.type = 'text';

        input.style.cssText = `
            width: ${Math.max(250, editableSubject.offsetWidth)}px;
            font-family: ${computedStyle.fontFamily};
            font-size: ${computedStyle.fontSize};
            font-weight: ${computedStyle.fontWeight};
        `;

        editableSubject.innerHTML = '';
        editableSubject.appendChild(input);

        editActions.style.display = 'flex';
        input.focus();
        input.select();

        this.emailEditState.currentEditInput = input;
    }

    // Start editing body
    startBodyEdit() {
        if (this.emailEditState.isEditing || !this.currentAnalysis) return;

        const editableBody = document.getElementById('emailBody');
        const editActions = document.querySelector('.edit-actions');

        this.emailEditState.isEditing = true;
        this.emailEditState.originalBody = editableBody.innerHTML.replace(/<br>/g, '\n');

        const currentHeight = editableBody.offsetHeight;

        const textarea = document.createElement('textarea');
        textarea.className = 'editing-textarea';
        textarea.value = this.emailEditState.originalBody;
        textarea.maxLength = 2000;

        const targetHeight = Math.max(currentHeight, 80);
        textarea.style.height = `${targetHeight}px`;

        editableBody.style.display = 'none';
        editableBody.parentNode.insertBefore(textarea, editableBody.nextSibling);

        editActions.style.display = 'flex';
        textarea.focus();

        this.emailEditState.currentEditTextarea = textarea;
    }

    // Save email changes
    saveEmailChanges() {
        if (!this.emailEditState.isEditing) return;

        const editableSubject = document.getElementById('emailSubject');
        const editableBody = document.getElementById('emailBody');
        const editActions = document.querySelector('.edit-actions');

        let newSubject = this.emailEditState.originalSubject;
        let newBody = this.emailEditState.originalBody;

        try {
            // Get new values
            if (this.emailEditState.currentEditInput) {
                newSubject = this.emailEditState.currentEditInput.value.trim();
                if (!newSubject) {
                    this.showNotification('Subject cannot be empty', 'error');
                    return;
                }
                editableSubject.textContent = newSubject;
                this.emailEditState.currentEditInput = null;
            }

            if (this.emailEditState.currentEditTextarea) {
                newBody = this.emailEditState.currentEditTextarea.value.trim();
                if (!newBody) {
                    this.showNotification('Email body cannot be empty', 'error');
                    return;
                }
                editableBody.innerHTML = newBody.replace(/\n/g, '<br>');
                this.emailEditState.currentEditTextarea.remove();
                this.emailEditState.currentEditTextarea = null;
                editableBody.style.display = 'block';
            }

            // Update the current analysis data
            if (this.currentAnalysis) {
                this.currentAnalysis.email_subject = newSubject;
                this.currentAnalysis.email_body = newBody;
            }

            // Hide edit actions
            editActions.style.display = 'none';
            this.emailEditState.isEditing = false;

            this.showNotification('Email updated successfully!', 'success');

        } catch (error) {
            console.error('Error saving email changes:', error);
            this.showNotification('Failed to save changes', 'error');
            this.cancelEmailEditing();
        }
    }

    // Cancel email editing
    cancelEmailEditing() {
        if (!this.emailEditState.isEditing) return;

        const editableSubject = document.getElementById('emailSubject');
        const editableBody = document.getElementById('emailBody');
        const editActions = document.querySelector('.edit-actions');

        try {
            if (this.emailEditState.currentEditInput) {
                editableSubject.textContent = this.emailEditState.originalSubject;
                this.emailEditState.currentEditInput = null;
            }

            if (this.emailEditState.currentEditTextarea) {
                this.emailEditState.currentEditTextarea.remove();
                this.emailEditState.currentEditTextarea = null;
                editableBody.style.display = 'block';
            }

            editActions.style.display = 'none';
            this.emailEditState.isEditing = false;

        } catch (error) {
            console.error('Error canceling email editing:', error);
            editActions.style.display = 'none';
            this.emailEditState.isEditing = false;
        }
    }

    // Update UI based on current state
    updateUI() {
        // Additional UI updates can be added here
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});