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
        this.isFromBulkAnalysis = false;
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
        document.getElementById('bulkAnalyzeBtn').addEventListener('click', () => this.showBulkSettings());
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

        // Bulk settings event listeners
        document.getElementById('closeBulkSettings').addEventListener('click', () => this.hideBulkSettings());
        document.getElementById('cancelBulkSettings').addEventListener('click', () => this.hideBulkSettings());
        document.getElementById('startBulkAnalysis').addEventListener('click', () => this.startBulkAnalysisWithSettings());

        // Cache management event listeners
        document.getElementById('cacheManagementBtn').addEventListener('click', () => this.showCacheManagement());
        document.getElementById('closeCacheSettings').addEventListener('click', () => this.hideCacheManagement());
        document.getElementById('refreshCacheStats').addEventListener('click', () => this.refreshCacheStats());
        document.getElementById('forceCacheCleanup').addEventListener('click', () => this.forceCacheCleanup());
        document.getElementById('clearAllCache').addEventListener('click', () => this.clearAllCache());

        // Event delegation for dynamic job action buttons (CSP-compliant)
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="view-details"]')) {
                const index = parseInt(e.target.dataset.index);
                this.viewJobDetails(index);
            } else if (e.target.matches('[data-action="quick-apply"]')) {
                const index = parseInt(e.target.dataset.index);
                this.quickApplyFromBulk(index);
            }
        });
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

        // Hide bulk results if showing
        document.getElementById('bulkResultsSection').style.display = 'none';
        this.isFromBulkAnalysis = false;

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

        // Add back button if coming from bulk analysis
        this.addBackToBulkButton();

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
    }    // Bulk analyze multiple jobs with configuration
    async bulkAnalyzeJobsWithConfig(settings = null) {
        // Get settings if not provided
        if (!settings) {
            const result = await chrome.storage.local.get(['bulkAnalysisSettings']);
            settings = result.bulkAnalysisSettings || {
                postCount: 10,
                autoLoadMore: true,
                enhancedAIFilter: true
            };
        }

        // Hide single analysis results and show bulk results section
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('bulkResultsSection').style.display = 'block';

        this.showLoading('Optimizing cache for bulk analysis...');
        this.showBulkProgress('Initializing...', 0);

        try {
            // Optimize cache for bulk operations
            this.updateBulkProgress('Optimizing cache for bulk analysis...', 5);
            try {
                await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        type: 'OPTIMIZE_CACHE_FOR_BULK'
                    }, resolve);
                });
                console.log('✅ Cache optimized for bulk analysis');
            } catch (error) {
                console.warn('⚠️ Cache optimization failed, continuing without optimization:', error);
            }

            // Get multiple job posts from current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('linkedin.com')) {
                this.showNotification('Please navigate to LinkedIn to use bulk analysis', 'error');
                return;
            }

            this.updateBulkProgress('Extracting job posts from page...', 10);

            // Request bulk job data from content script with enhanced settings
            const response = await new Promise((resolve) => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'GET_BULK_JOB_DATA',
                    limit: settings.postCount,
                    autoLoadMore: settings.autoLoadMore,
                    enhancedFilter: settings.enhancedAIFilter
                }, resolve);
            });

            if (chrome.runtime.lastError) {
                throw new Error('Failed to communicate with page. Please refresh and try again.');
            }

            if (!response || !response.success) {
                throw new Error(response?.error || 'Failed to extract job posts from page');
            }

            const jobPosts = response.data;

            if (!jobPosts || jobPosts.length === 0) {
                this.showBulkEmptyState();
                return;
            }

            this.updateBulkProgress(`Found ${jobPosts.length} job posts. Starting analysis...`, 20);

            // Pre-filter jobs using enhanced AI if enabled
            let filteredJobs = jobPosts;
            if (settings.enhancedAIFilter) {
                this.updateBulkProgress('Pre-filtering jobs with AI...', 30);
                filteredJobs = await this.preFilterJobsWithAI(jobPosts);
                this.updateBulkProgress(`Pre-filtered to ${filteredJobs.length} relevant jobs`, 40);
            }

            // Analyze each job post
            const analyzedJobs = [];
            const totalJobs = filteredJobs.length;

            for (let i = 0; i < totalJobs; i++) {
                const job = filteredJobs[i];
                const progressPercent = 40 + ((i / totalJobs) * 50); // 40-90% for analysis
                this.updateBulkProgress(`Analyzing job ${i + 1} of ${totalJobs}...`, progressPercent);

                try {
                    const analysisResponse = await new Promise((resolve) => {
                        chrome.runtime.sendMessage({
                            type: 'ANALYZE_JOB',
                            data: job
                        }, resolve);
                    });

                    if (analysisResponse && analysisResponse.success) {
                        analyzedJobs.push({
                            ...job,
                            analysis: analysisResponse.data,
                            relevanceScore: this.calculateRelevanceScore(analysisResponse.data)
                        });
                        this.updateStats('analyzed');

                        if (analysisResponse.data.status === 'RELEVANT') {
                            this.updateStats('relevant');
                        }
                    } else {
                        // Add job with failed analysis
                        analyzedJobs.push({
                            ...job,
                            analysis: {
                                status: 'ERROR',
                                reason: 'Failed to analyze this job post',
                                email_subject: '',
                                email_body: '',
                                contact: null
                            },
                            relevanceScore: 0
                        });
                    }
                } catch (error) {
                    console.error('Error analyzing job:', error);
                    analyzedJobs.push({
                        ...job,
                        analysis: {
                            status: 'ERROR',
                            reason: 'Error occurred during analysis',
                            email_subject: '',
                            email_body: '',
                            contact: null
                        },
                        relevanceScore: 0
                    });
                }

                // Check storage usage every 10 jobs during bulk analysis
                if ((i + 1) % 10 === 0) {
                    try {
                        const storageResponse = await new Promise((resolve) => {
                            chrome.runtime.sendMessage({
                                type: 'GET_STORAGE_INFO'
                            }, resolve);
                        });

                        if (storageResponse && storageResponse.success) {
                            const { usageRatio } = storageResponse.data;
                            console.log(`📊 Storage check after ${i + 1} jobs: ${Math.round(usageRatio * 100)}% used`);

                            // If storage is getting full, force cleanup
                            if (usageRatio > 0.9) {
                                console.warn('🚨 Storage critical during bulk analysis, forcing cleanup');
                                await new Promise((resolve) => {
                                    chrome.runtime.sendMessage({
                                        type: 'FORCE_CACHE_CLEANUP'
                                    }, resolve);
                                });
                            }
                        }
                    } catch (storageError) {
                        console.warn('Could not check storage during bulk analysis:', storageError);
                    }
                }
            }

            this.updateBulkProgress('Sorting results...', 95);

            // Sort by relevance score (highest first)
            analyzedJobs.sort((a, b) => b.relevanceScore - a.relevanceScore);

            this.updateBulkProgress('Complete!', 100);

            // Check cache stats after bulk analysis
            try {
                const cacheStatsResponse = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        type: 'GET_CACHE_STATS'
                    }, resolve);
                });

                if (cacheStatsResponse && cacheStatsResponse.success) {
                    const stats = cacheStatsResponse.data;
                    console.log(`📊 Post-bulk cache stats: ${stats.validEntries} entries, ${stats.storageUsageRatio}% storage used, ${stats.cacheHitRate}% hit rate`);

                    // Show warning if storage usage is high
                    if (stats.storageUsageRatio > 85) {
                        this.showNotification(`⚠️ Storage ${stats.storageUsageRatio}% full. Cache will auto-cleanup.`, 'warning');
                    }
                }
            } catch (error) {
                console.warn('Could not get cache stats:', error);
            }

            // Display results
            this.displayBulkResults(analyzedJobs);

        } catch (error) {
            console.error('Error in bulk analysis:', error);
            this.showNotification(error.message || 'Failed to perform bulk analysis', 'error');
            this.showBulkEmptyState();
        } finally {
            this.hideLoading();
            this.hideBulkProgress();
        }
    }

    // Pre-filter jobs using AI before full analysis
    async preFilterJobsWithAI(jobPosts) {
        try {
            // Send all jobs for quick relevance check
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'PRE_FILTER_JOBS',
                    data: { jobs: jobPosts }
                }, resolve);
            });

            if (response && response.success) {
                return response.data.filteredJobs || jobPosts;
            } else {
                console.warn('Pre-filtering failed, using all jobs');
                return jobPosts;
            }
        } catch (error) {
            console.error('Error in pre-filtering:', error);
            return jobPosts; // Return all jobs if filtering fails
        }
    }

    // Show bulk progress indicator
    showBulkProgress(text, percentage) {
        let progressContainer = document.getElementById('bulkProgressContainer');

        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.id = 'bulkProgressContainer';
            progressContainer.className = 'bulk-progress';
            progressContainer.innerHTML = `
                <div class="bulk-progress-header">
                    <span class="bulk-progress-text" id="bulkProgressText">${text}</span>
                    <span class="bulk-progress-percentage" id="bulkProgressPercentage">${Math.round(percentage)}%</span>
                </div>
                <div class="bulk-progress-bar">
                    <div class="bulk-progress-fill" id="bulkProgressFill"></div>
                </div>
                <div class="bulk-progress-stats">
                    <span id="bulkProgressFound">0 found</span>
                    <span id="bulkProgressAnalyzed">0 analyzed</span>
                    <span id="bulkProgressRelevant">0 relevant</span>
                </div>
            `;

            // Insert after loading overlay or before bulk results
            const bulkResults = document.getElementById('bulkResultsSection');
            if (bulkResults) {
                bulkResults.insertBefore(progressContainer, bulkResults.firstChild);
            }
        }

        this.updateBulkProgress(text, percentage);
    }

    // Update bulk progress
    updateBulkProgress(text, percentage) {
        const progressText = document.getElementById('bulkProgressText');
        const progressPercentage = document.getElementById('bulkProgressPercentage');
        const progressFill = document.getElementById('bulkProgressFill');

        if (progressText) progressText.textContent = text;
        if (progressPercentage) progressPercentage.textContent = `${Math.round(percentage)}%`;
        if (progressFill) progressFill.style.width = `${percentage}%`;
    }

    // Hide bulk progress
    hideBulkProgress() {
        const progressContainer = document.getElementById('bulkProgressContainer');
        if (progressContainer) {
            progressContainer.remove();
        }
    }

    // Show bulk settings modal
    showBulkSettings() {
        // Load saved settings
        this.loadBulkSettings();
        document.getElementById('bulkSettingsSection').style.display = 'block';
    }

    // Hide bulk settings modal
    hideBulkSettings() {
        document.getElementById('bulkSettingsSection').style.display = 'none';
    }

    // Load bulk analysis settings
    async loadBulkSettings() {
        try {
            const result = await chrome.storage.local.get(['bulkAnalysisSettings']);
            const settings = result.bulkAnalysisSettings || {
                postCount: 10,
                autoLoadMore: true,
                enhancedAIFilter: true
            };

            document.getElementById('postCountInput').value = settings.postCount;
            document.getElementById('autoLoadMore').checked = settings.autoLoadMore;
            document.getElementById('enhancedAIFilter').checked = settings.enhancedAIFilter;
        } catch (error) {
            console.error('Error loading bulk settings:', error);
        }
    }

    // Save bulk analysis settings
    async saveBulkSettings() {
        const settings = {
            postCount: parseInt(document.getElementById('postCountInput').value) || 10,
            autoLoadMore: document.getElementById('autoLoadMore').checked,
            enhancedAIFilter: document.getElementById('enhancedAIFilter').checked
        };

        try {
            await chrome.storage.local.set({ bulkAnalysisSettings: settings });
            return settings;
        } catch (error) {
            console.error('Error saving bulk settings:', error);
            return null;
        }
    }

    // Start bulk analysis with current settings
    async startBulkAnalysisWithSettings() {
        const settings = await this.saveBulkSettings();
        if (settings) {
            this.hideBulkSettings();
            this.bulkAnalyzeJobsWithConfig(settings);
        }
    }

    // Calculate relevance score for job analysis
    calculateRelevanceScore(analysis) {
        if (!analysis) return 0;

        switch (analysis.status) {
            case 'RELEVANT':
                return 85 + Math.random() * 15; // 85-100
            case 'PARTIALLY_RELEVANT':
                return 50 + Math.random() * 35; // 50-85
            case 'NOT_RELEVANT':
                return Math.random() * 30; // 0-30
            case 'ERROR':
                return 0;
            default:
                return 50;
        }
    }

    // Display bulk analysis results (grouped by category, modern UI)
    displayBulkResults(analyzedJobs) {
        const jobList = document.getElementById('jobList');
        const totalAnalyzed = document.getElementById('totalAnalyzed');
        const totalRelevant = document.getElementById('totalRelevant');
        const bulkResultsSection = document.getElementById('bulkResultsSection');

        // Clear previous results
        jobList.innerHTML = '';

        // Store analyzed jobs data for later access
        bulkResultsSection.dataset.analyzedJobs = JSON.stringify(analyzedJobs);

        // Group jobs by category
        const relevantJobs = analyzedJobs.filter(job => job.analysis.status === 'RELEVANT');
        const maybeJobs = analyzedJobs.filter(job => job.analysis.status === 'PARTIALLY_RELEVANT' || job.analysis.status === 'MAYBE');
        const notRelevantJobs = analyzedJobs.filter(job => job.analysis.status === 'NOT_RELEVANT' || job.analysis.status === 'ERROR');

        totalAnalyzed.textContent = `${analyzedJobs.length} analyzed`;
        totalRelevant.textContent = `${relevantJobs.length} relevant`;

        // Helper to create section
        const createSection = (title, icon, jobs, colorClass) => {
            if (!jobs.length) return '';
            let html = `<div class="bulk-category ${colorClass}"><div class="bulk-category-header"><span class="cat-icon">${icon}</span> <span class="cat-title">${title}</span> <span class="cat-count">(${jobs.length})</span></div><div class="bulk-job-list">`;
            jobs.forEach((job, index) => {
                html += this.createBulkJobCard(job, index, colorClass);
            });
            html += '</div></div>';
            return html;
        };

        // Render all sections
        let allHtml = '';
        allHtml += createSection('Relevant', '✅', relevantJobs, 'relevant');
        allHtml += createSection('Maybe Relevant', '🤔', maybeJobs, 'maybe');
        allHtml += createSection('Not Relevant', '❌', notRelevantJobs, 'not-relevant');
        jobList.innerHTML = allHtml;

        // Add event listeners for job action buttons
        this.setupJobActionListeners();
        this.isFromBulkAnalysis = true;
    }

    // Create a modern card for each job in bulk analysis
    createBulkJobCard(job, index, colorClass) {
        const status = job.analysis.status || 'UNKNOWN';
        const statusMap = {
            'RELEVANT': { label: 'Relevant', icon: '✅', class: 'relevant' },
            'PARTIALLY_RELEVANT': { label: 'Maybe', icon: '🤔', class: 'maybe' },
            'MAYBE': { label: 'Maybe', icon: '🤔', class: 'maybe' },
            'NOT_RELEVANT': { label: 'Not Relevant', icon: '❌', class: 'not-relevant' },
            'ERROR': { label: 'Error', icon: '⚠️', class: 'not-relevant' },
            'UNKNOWN': { label: 'Unknown', icon: '❓', class: 'maybe' }
        };
        const statusInfo = statusMap[status] || statusMap['UNKNOWN'];
        const relevanceScore = Math.round(job.relevanceScore || 0);
        return `
        <div class="bulk-job-card ${colorClass}">
            <div class="card-header">
                <span class="status-badge ${statusInfo.class}">${statusInfo.icon} ${statusInfo.label}</span>
                <span class="score-badge">${relevanceScore}%</span>
            </div>
            <div class="card-title">${this.truncateText(job.title, 60)}</div>
            <div class="card-meta">
                <span class="company">${this.truncateText(job.company, 30)}</span>
                ${job.location ? `<span class="location">${this.truncateText(job.location, 25)}</span>` : ''}
            </div>
            <div class="card-reason">${this.truncateText(job.analysis.reason, 120)}</div>
            <div class="card-actions">
                <button class="btn-small btn-outline" data-action="view-details" data-index="${index}">View Details</button>
                ${status === 'RELEVANT' ? `<button class="btn-small btn-primary" data-action="quick-apply" data-index="${index}">Quick Apply</button>` : ''}
            </div>
        </div>
        `;
    }

    // Setup event listeners for job action buttons in bulk analysis results
    setupJobActionListeners() {
        // Use event delegation for dynamically created job cards
        const jobList = document.getElementById('jobList');

        if (!jobList) return;

        // Remove existing listeners if any
        jobList.removeEventListener('click', this._handleJobActionClick);

        // Create handler function bound to this context
        this._handleJobActionClick = (event) => {
            const actionButton = event.target.closest('[data-action]');
            if (!actionButton) return;

            const action = actionButton.dataset.action;
            const index = parseInt(actionButton.dataset.index);

            if (isNaN(index)) return;

            if (action === 'view-details') {
                this.viewJobDetails(index);
            } else if (action === 'quick-apply') {
                this.quickApplyFromBulk(index);
            }
        };

        // Add the listener to the job list container
        jobList.addEventListener('click', this._handleJobActionClick);

        console.log('✅ Job action listeners setup complete');
    }

    // View job details from bulk results
    viewJobDetails(index) {
        const bulkResults = document.querySelector('.bulk-results-section');
        if (bulkResults && bulkResults.dataset.analyzedJobs) {
            const analyzedJobs = JSON.parse(bulkResults.dataset.analyzedJobs);
            const job = analyzedJobs[index];

            if (job) {
                this.currentJobData = job;
                this.currentAnalysis = job.analysis;
                this.displayAnalysisResults(job.analysis);
                document.getElementById('bulkResultsSection').style.display = 'none';
            }
        }
    }

    // Quick apply from bulk results
    quickApplyFromBulk(index) {
        const bulkResults = document.querySelector('.bulk-results-section');
        if (bulkResults && bulkResults.dataset.analyzedJobs) {
            const analyzedJobs = JSON.parse(bulkResults.dataset.analyzedJobs);
            const job = analyzedJobs[index];

            if (job && job.analysis.status === 'RELEVANT') {
                this.currentAnalysis = job.analysis;
                this.copyEmail();
            }
        }
    }

    // Add back to bulk button
    addBackToBulkButton() {
        if (!this.isFromBulkAnalysis) return;

        const resultsSection = document.getElementById('resultsSection');
        let backButton = document.getElementById('backToBulkBtn');

        if (!backButton) {
            backButton = document.createElement('button');
            backButton.id = 'backToBulkBtn';
            backButton.className = 'btn btn-outline back-button';
            backButton.innerHTML = '← Back to Bulk Results';
            backButton.addEventListener('click', () => {
                document.getElementById('resultsSection').style.display = 'none';
                document.getElementById('bulkResultsSection').style.display = 'block';
            });

            resultsSection.insertBefore(backButton, resultsSection.firstChild);
        }
    }

    // Show empty state for bulk analysis
    showBulkEmptyState() {
        const jobList = document.getElementById('jobList');
        const totalAnalyzed = document.getElementById('totalAnalyzed');
        const totalRelevant = document.getElementById('totalRelevant');

        totalAnalyzed.textContent = '0 analyzed';
        totalRelevant.textContent = '0 relevant';

        jobList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <h3>No Jobs Found</h3>
                <p>No job posts were found on this page. Try:</p>
                <ul>
                    <li>Navigating to LinkedIn job search</li>
                    <li>Refreshing the page</li>
                    <li>Checking your search filters</li>
                </ul>
            </div>
        `;
    }

    // Utility function to truncate text
    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // Update UI method (referenced in init)
    updateUI() {
        // Update any dynamic UI elements
        this.updateStatsDisplay();
        this.updateThemeToggleIcon();
    }

    // Cache management methods
    async getCacheStats() {
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: 'GET_CACHE_STATS' }, resolve);
            });

            if (response && response.success) {
                return response.data;
            }
            return null;
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return null;
        }
    }

    async clearCache() {
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, resolve);
            });

            if (response && response.success) {
                this.showNotification(`Cleared ${response.clearedEntries} cached analyses`, 'success');
                return true;
            } else {
                this.showNotification('Failed to clear cache', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error clearing cache:', error);
            this.showNotification('Error clearing cache', 'error');
            return false;
        }
    }

    // === Cache Management Methods ===

    // Show cache management section
    showCacheManagement() {
        this.hideAllSections();
        document.getElementById('cacheSettingsSection').style.display = 'block';
        this.refreshCacheStats();
    }

    // Hide cache management section
    hideCacheManagement() {
        document.getElementById('cacheSettingsSection').style.display = 'none';
        this.showMainSection();
    }

    // Refresh cache statistics
    async refreshCacheStats() {
        try {
            this.showLoading('Fetching cache statistics...');

            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'GET_CACHE_STATS'
                }, resolve);
            });

            if (response && response.success) {
                this.displayCacheStats(response.data);
            } else {
                this.showNotification('Failed to fetch cache statistics', 'error');
            }
        } catch (error) {
            console.error('Error refreshing cache stats:', error);
            this.showNotification('Error fetching cache statistics', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Display cache statistics in the UI
    displayCacheStats(stats) {
        // Update basic stats
        document.getElementById('cacheStatsTotal').textContent = stats.totalEntries || 0;
        document.getElementById('cacheStatsValid').textContent = stats.validEntries || 0;
        document.getElementById('cacheStatsSize').textContent = stats.totalSizeFormatted || '0 Bytes';
        document.getElementById('cacheStatsHitRate').textContent = stats.cacheHitRate ? `${stats.cacheHitRate}%` : '0%';
        document.getElementById('cacheStatsStorage').textContent = stats.storageUsageFormatted || '0 Bytes';

        // Update storage progress bar
        const storagePercent = stats.storageUsageRatio || 0;
        const progressFill = document.getElementById('storageProgressFill');
        const percentageText = document.getElementById('storagePercentage');

        progressFill.style.width = `${storagePercent}%`;
        percentageText.textContent = `${storagePercent}%`;

        // Apply warning styles based on usage
        const progressBar = progressFill.parentElement;
        progressBar.classList.remove('storage-warning', 'storage-critical');

        if (storagePercent >= 95) {
            progressBar.classList.add('storage-critical');
        } else if (storagePercent >= 80) {
            progressBar.classList.add('storage-warning');
        }

        // Update advanced details
        document.getElementById('cacheExpiredEntries').textContent = stats.expiredEntries || 0;

        if (stats.oldestEntry) {
            document.getElementById('cacheOldestEntry').textContent =
                `${stats.oldestEntry.jobTitle} (${stats.oldestEntry.age}h ago)`;
        } else {
            document.getElementById('cacheOldestEntry').textContent = 'None';
        }

        if (stats.newestEntry) {
            document.getElementById('cacheNewestEntry').textContent =
                `${stats.newestEntry.jobTitle} (${stats.newestEntry.age}m ago)`;
        } else {
            document.getElementById('cacheNewestEntry').textContent = 'None';
        }

        console.log('📊 Cache stats updated:', stats);
    }

    // Force cache cleanup
    async forceCacheCleanup() {
        try {
            const confirmed = confirm('This will remove older cache entries to free up space. Continue?');
            if (!confirmed) return;

            this.showLoading('Performing cache cleanup...');

            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'FORCE_CACHE_CLEANUP'
                }, resolve);
            });

            if (response && response.success) {
                this.showNotification(`✅ Cleanup complete! Removed ${response.removedEntries} entries`, 'success');
                // Refresh stats after cleanup
                setTimeout(() => this.refreshCacheStats(), 1000);
            } else {
                this.showNotification('Failed to perform cache cleanup', 'error');
            }
        } catch (error) {
            console.error('Error in force cleanup:', error);
            this.showNotification('Error during cache cleanup', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Clear all cache
    async clearAllCache() {
        try {
            const confirmed = confirm('This will permanently delete all cached job analyses. This action cannot be undone. Continue?');
            if (!confirmed) return;

            this.showLoading('Clearing all cache...');

            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'CLEAR_CACHE'
                }, resolve);
            });

            if (response && response.success) {
                this.showNotification(`🗑️ Cache cleared! Removed ${response.clearedEntries} entries`, 'success');
                // Refresh stats after clearing
                setTimeout(() => this.refreshCacheStats(), 1000);
            } else {
                this.showNotification('Failed to clear cache', 'error');
            }
        } catch (error) {
            console.error('Error clearing cache:', error);
            this.showNotification('Error clearing cache', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Hide all popup sections
    hideAllSections() {
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('bulkResultsSection').style.display = 'none';
        document.getElementById('bulkSettingsSection').style.display = 'none';
        document.getElementById('cacheSettingsSection').style.display = 'none';
    }

    // Show main section (return to main view)
    showMainSection() {
        this.hideAllSections();
        // Main section is always visible by default when other sections are hidden
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.popupController = new PopupController();
});