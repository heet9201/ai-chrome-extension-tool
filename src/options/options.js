// Options Page Script for LinkedIn Job Assistant
class OptionsController {
    constructor() {
        this.userProfile = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupTabs();
        this.setupFileUpload();
        await this.loadUserProfile();
        this.populateForm();
        this.updateLastUpdated();
    }

    // Setup event listeners
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Form actions
        document.getElementById('saveBtn').addEventListener('click', () => this.saveAllSettings());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetToDefaults());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportSettings());

        // Email actions
        document.getElementById('testEmailBtn').addEventListener('click', () => this.testEmail());
        document.getElementById('saveEmailBtn').addEventListener('click', () => this.saveEmailSettings());

        // Notification close
        document.getElementById('notificationClose').addEventListener('click', () => this.hideNotification());

        // Form change detection
        document.querySelectorAll('input, select, textarea').forEach(element => {
            element.addEventListener('change', () => this.markAsChanged());
        });
    }

    // Setup tab navigation
    setupTabs() {
        const urlParams = new URLSearchParams(window.location.search);
        const activeTab = urlParams.get('tab') || 'profile';
        this.switchTab(activeTab);
    }

    // Switch between tabs
    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });

        // Show selected tab content
        const targetContent = document.getElementById(tabName);
        const targetButton = document.querySelector(`[data-tab="${tabName}"]`);

        if (targetContent && targetButton) {
            targetContent.classList.add('active');
            targetButton.classList.add('active');
        }

        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('tab', tabName);
        window.history.replaceState({}, '', url);
    }

    // Setup file upload functionality
    setupFileUpload() {
        const uploadArea = document.getElementById('resumeUploadArea');
        const fileInput = document.getElementById('resume');

        // Click to upload
        uploadArea.addEventListener('click', () => fileInput.click());

        // File selection
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files[0]));

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) {
                this.handleFileUpload(file);
            }
        });
    }

    // Handle file upload
    async handleFileUpload(file) {
        if (!file) return;

        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (!allowedTypes.includes(file.type)) {
            this.showNotification('Invalid file type. Please upload PDF, DOC, DOCX, or TXT files.', 'error');
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('File size too large. Please upload files smaller than 5MB.', 'error');
            return;
        }

        this.showLoading('Uploading resume...');

        try {
            const formData = new FormData();
            formData.append('resume', file);

            const response = await fetch('http://localhost:5000/api/upload-resume', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.updateResumeStatus(file.name, 'success');
                this.showNotification('Resume uploaded successfully!', 'success');

                // Update user profile with resume path
                if (this.userProfile) {
                    this.userProfile.resumeUrl = result.path;
                    await this.saveUserProfile();
                }
            } else {
                throw new Error(result.error || 'Upload failed');
            }

        } catch (error) {
            console.error('Error uploading resume:', error);
            this.updateResumeStatus('Upload failed', 'error');
            this.showNotification('Failed to upload resume. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Update resume upload status
    updateResumeStatus(message, type) {
        const statusElement = document.getElementById('resumeStatus');
        statusElement.textContent = message;
        statusElement.className = `upload-status ${type}`;
        statusElement.style.display = 'block';
    }

    // Load user profile
    async loadUserProfile() {
        try {
            const result = await chrome.storage.sync.get(['userProfile']);
            this.userProfile = result.userProfile || this.getDefaultProfile();
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.userProfile = this.getDefaultProfile();
        }
    }

    // Get default profile
    getDefaultProfile() {
        return {
            name: 'Heet Dedakiya',
            email: 'heet.dedakiya@example.com',
            phone: '+91-XXXXXXXXXX',
            experience: '1',
            domain: 'Python Backend Development + AI/ML',
            skills: 'Python, Flask, FastAPI, TensorFlow, HuggingFace, OpenAI API, Pandas, NumPy',
            preferredRoles: ['Backend Developer', 'AI/ML Engineer'],
            preferredWorkType: ['Remote', 'Hybrid'],
            excludedRoles: ['Frontend', 'Sales'],
            preferredCompanyTypes: ['Startups', 'AI Companies'],
            preferredLocations: 'Ahmedabad, Pune, Bengaluru',
            emailAddress: '',
            emailPassword: '',
            smtpServer: 'smtp.gmail.com',
            smtpPort: '587',
            emailSignature: 'Best regards,\nHeet Dedakiya\nPython Backend Developer & AI/ML Engineer',
            resumeUrl: ''
        };
    }

    // Populate form with user data
    populateForm() {
        if (!this.userProfile) return;

        // Personal information
        document.getElementById('name').value = this.userProfile.name || '';
        document.getElementById('email').value = this.userProfile.email || '';
        document.getElementById('phone').value = this.userProfile.phone || '';
        document.getElementById('experience').value = this.userProfile.experience || '';
        document.getElementById('domain').value = this.userProfile.domain || '';
        document.getElementById('skills').value = this.userProfile.skills || '';
        document.getElementById('preferredLocations').value = this.userProfile.preferredLocations || '';

        // Email settings
        document.getElementById('emailAddress').value = this.userProfile.emailAddress || '';
        document.getElementById('emailPassword').value = this.userProfile.emailPassword || '';
        document.getElementById('smtpServer').value = this.userProfile.smtpServer || 'smtp.gmail.com';
        document.getElementById('smtpPort').value = this.userProfile.smtpPort || '587';
        document.getElementById('emailSignature').value = this.userProfile.emailSignature || '';

        // Checkboxes
        this.populateCheckboxes('input[value="Backend Developer"]', this.userProfile.preferredRoles);
        this.populateCheckboxes('input[value="AI/ML Engineer"]', this.userProfile.preferredRoles);
        this.populateCheckboxes('input[value="Remote"]', this.userProfile.preferredWorkType);
        this.populateCheckboxes('input[value="Hybrid"]', this.userProfile.preferredWorkType);
        this.populateCheckboxes('input[value="Frontend"]', this.userProfile.excludedRoles);
        this.populateCheckboxes('input[value="Sales"]', this.userProfile.excludedRoles);
        this.populateCheckboxes('input[value="Startups"]', this.userProfile.preferredCompanyTypes);
        this.populateCheckboxes('input[value="AI Companies"]', this.userProfile.preferredCompanyTypes);

        // Resume status
        if (this.userProfile.resumeUrl) {
            this.updateResumeStatus('Resume uploaded', 'success');
        }
    }

    // Populate checkbox arrays
    populateCheckboxes(selector, values) {
        const checkboxes = document.querySelectorAll(selector);
        checkboxes.forEach(checkbox => {
            checkbox.checked = values && values.includes(checkbox.value);
        });
    }

    // Collect form data
    collectFormData() {
        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            experience: document.getElementById('experience').value,
            domain: document.getElementById('domain').value,
            skills: document.getElementById('skills').value,
            preferredLocations: document.getElementById('preferredLocations').value,
            emailAddress: document.getElementById('emailAddress').value,
            emailPassword: document.getElementById('emailPassword').value,
            smtpServer: document.getElementById('smtpServer').value,
            smtpPort: document.getElementById('smtpPort').value,
            emailSignature: document.getElementById('emailSignature').value,
            preferredRoles: this.getCheckedValues('input[type="checkbox"][value*="Developer"], input[type="checkbox"][value*="Engineer"], input[type="checkbox"][value*="Scientist"]'),
            preferredWorkType: this.getCheckedValues('input[value="Remote"], input[value="Hybrid"], input[value="On-site"]'),
            excludedRoles: this.getCheckedValues('input[value="Frontend"], input[value="Sales"], input[value="DevOps"], input[value="Mobile"], input[value="Marketing"]'),
            preferredCompanyTypes: this.getCheckedValues('input[value="Startups"], input[value="AI Companies"], input[value="Product Companies"], input[value="MNCs"]'),
            resumeUrl: this.userProfile ? this.userProfile.resumeUrl || '' : ''
        };

        return formData;
    }

    // Get checked checkbox values
    getCheckedValues(selector) {
        const checkboxes = document.querySelectorAll(selector);
        return Array.from(checkboxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);
    }

    // Save all settings
    async saveAllSettings() {
        this.showLoading('Saving settings...');

        try {
            const formData = this.collectFormData();

            // Validate required fields
            const requiredFields = ['name', 'email', 'experience', 'domain', 'skills'];
            for (const field of requiredFields) {
                if (!formData[field]) {
                    throw new Error(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`);
                }
            }

            // Save to Chrome storage
            await chrome.storage.sync.set({ userProfile: formData });

            // Update local profile
            this.userProfile = formData;

            this.showNotification('Settings saved successfully!', 'success');
            this.markAsSaved();

        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification(`Error saving settings: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Save user profile to backend
    async saveUserProfile() {
        try {
            const response = await fetch('http://localhost:5000/api/user-profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.userProfile)
            });

            if (!response.ok) {
                throw new Error('Failed to save profile to backend');
            }

        } catch (error) {
            console.error('Error saving profile to backend:', error);
            // Continue anyway since local storage is primary
        }
    }

    // Test email configuration
    async testEmail() {
        const emailAddress = document.getElementById('emailAddress').value;

        if (!emailAddress) {
            this.showNotification('Please enter your email address first', 'warning');
            return;
        }

        this.showLoading('Testing email configuration...');

        try {
            const response = await fetch('http://localhost:5000/api/test-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: emailAddress })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Test email sent successfully! Check your inbox.', 'success');
            } else {
                throw new Error(result.error || 'Test email failed');
            }

        } catch (error) {
            console.error('Error testing email:', error);
            this.showNotification(`Email test failed: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Save email settings
    async saveEmailSettings() {
        this.showLoading('Saving email settings...');

        try {
            const emailData = {
                emailAddress: document.getElementById('emailAddress').value,
                emailPassword: document.getElementById('emailPassword').value,
                smtpServer: document.getElementById('smtpServer').value,
                smtpPort: document.getElementById('smtpPort').value,
                emailSignature: document.getElementById('emailSignature').value
            };

            // Update user profile with email settings
            this.userProfile = { ...this.userProfile, ...emailData };

            // Save to storage
            await chrome.storage.sync.set({ userProfile: this.userProfile });

            this.showNotification('Email settings saved successfully!', 'success');

        } catch (error) {
            console.error('Error saving email settings:', error);
            this.showNotification('Failed to save email settings', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Reset to defaults
    async resetToDefaults() {
        if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            return;
        }

        this.showLoading('Resetting to defaults...');

        try {
            this.userProfile = this.getDefaultProfile();
            await chrome.storage.sync.set({ userProfile: this.userProfile });
            this.populateForm();
            this.showNotification('Settings reset to defaults', 'success');
        } catch (error) {
            console.error('Error resetting settings:', error);
            this.showNotification('Failed to reset settings', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Export settings
    exportSettings() {
        try {
            const settings = {
                userProfile: this.userProfile,
                exportDate: new Date().toISOString(),
                version: '1.0.0'
            };

            const dataStr = JSON.stringify(settings, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `linkedin-job-assistant-settings-${new Date().toISOString().split('T')[0]}.json`;
            link.click();

            this.showNotification('Settings exported successfully!', 'success');

        } catch (error) {
            console.error('Error exporting settings:', error);
            this.showNotification('Failed to export settings', 'error');
        }
    }

    // Mark form as changed
    markAsChanged() {
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.textContent = 'Save Changes*';
            saveBtn.style.background = '#ffc107';
        }
    }

    // Mark form as saved
    markAsSaved() {
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.textContent = 'Save All Settings';
            saveBtn.style.background = '';
        }
    }

    // Update last updated timestamp
    updateLastUpdated() {
        const lastUpdatedElement = document.getElementById('lastUpdated');
        if (lastUpdatedElement) {
            lastUpdatedElement.textContent = new Date().toLocaleDateString();
        }
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

        // Auto-hide after 5 seconds
        setTimeout(() => this.hideNotification(), 5000);
    }

    // Hide notification
    hideNotification() {
        document.getElementById('notification').style.display = 'none';
    }
}

// Initialize options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new OptionsController();
});
