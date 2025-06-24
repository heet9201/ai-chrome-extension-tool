// Options Page Script for LinkedIn Job Assistant
class OptionsController {
    constructor() {
        this.userProfile = null;
        this.isLoadingAiSettings = false; // Flag to prevent concurrent loading
        this.lastAiSettingsLoad = 0; // Timestamp of last load to prevent rapid calls
        this.AI_SETTINGS_DEBOUNCE_MS = 1000; // Minimum time between loads
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupTabs();
        this.setupFileUpload();
        this.initializeApiKeyInputs();
        await this.loadUserProfile();
        await this.loadAiSettings();
        this.populateForm();
        this.updateLastUpdated();
    }

    // Initialize API key inputs to proper state
    initializeApiKeyInputs() {
        const apiKeyInputs = ['openaiApiKey', 'groqApiKey'];

        apiKeyInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                // Initialize data attributes but don't force any specific state
                // The actual state will be determined by loadApiKeyStatus()
                input.dataset.hasStoredKey = 'false';
                input.dataset.showingStoredKey = 'false';
                input.dataset.userEnteredKey = '';

                // Find the toggle button by ID (more reliable)
                const provider = inputId.replace('ApiKey', '');
                const toggleButton = document.getElementById(`${provider}ToggleBtn`);
                if (toggleButton) {
                    toggleButton.textContent = '👁️';
                    toggleButton.title = 'Show API key';
                }

                // Add click listener to input for editing
                input.addEventListener('click', async () => {
                    await this.makeInputEditable(inputId);
                });

                // Add input listener for user typing
                input.addEventListener('input', (e) => {
                    if (!e.target.hasAttribute('readonly')) {
                        e.target.dataset.userEnteredKey = e.target.value;
                        e.target.dataset.showingStoredKey = 'false';
                        console.log(`📝 User input captured for ${inputId}: "${e.target.value}"`);
                        console.log(`📝 userEnteredKey set to: "${e.target.dataset.userEnteredKey}"`);
                        this.markAsChanged(); // Mark as changed when user types
                    }
                });
            }
        });
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

        // AI Settings actions
        document.getElementById('aiProvider').addEventListener('change', (e) => this.handleAiProviderChange(e.target.value));
        document.getElementById('testAiBtn').addEventListener('click', () => this.testAiConnection());
        document.getElementById('saveAiBtn').addEventListener('click', () => this.saveAiSettings());
        document.getElementById('clearAiKeys').addEventListener('click', () => this.clearAiKeys());
        document.getElementById('temperature').addEventListener('input', (e) => this.updateTemperatureValue(e.target.value));

        // Notification close
        document.getElementById('notificationClose').addEventListener('click', () => this.hideNotification());

        // Form change detection
        document.querySelectorAll('input, select, textarea').forEach(element => {
            element.addEventListener('change', () => this.markAsChanged());
        });

        // API key input tracking
        document.querySelectorAll('input[id$="ApiKey"]').forEach(input => {
            input.addEventListener('input', (e) => {
                // Mark that user has entered a key if they're typing
                if (e.target.type === 'text' || e.target.type === 'password') {
                    if (!e.target.hasAttribute('readonly')) {
                        e.target.dataset.userEnteredKey = e.target.value;
                        e.target.dataset.showingStoredKey = 'false';
                        console.log(`📝 API key input event for ${e.target.id}: "${e.target.value}"`);
                        console.log(`📝 userEnteredKey updated to: "${e.target.dataset.userEnteredKey}"`);
                    }
                }
            });
        });

        // API key management button listeners
        this.setupApiKeyButtonListeners();

        // Resume skills button listeners
        this.setupResumeSkillsListeners();
    }

    // Make API key input editable
    async makeInputEditable(inputId) {
        const input = document.getElementById(inputId);
        const provider = inputId.replace('ApiKey', '');

        if (!input) return;

        // If already editable, do nothing
        if (!input.hasAttribute('readonly')) return;

        console.log(`📝 Making ${inputId} editable`);
        console.log(`📊 Input state before edit:`, {
            hasStoredKey: input.dataset.hasStoredKey,
            storedKey: input.dataset.storedKey ? '[PRESENT]' : '[EMPTY]',
            value: input.value ? '[PRESENT]' : '[EMPTY]',
            type: input.type
        });

        // Make input editable
        input.removeAttribute('readonly');
        input.classList.add('editing');
        input.type = 'text'; // Always show as text while editing

        // If we have a stored key, load it for editing
        if (input.dataset.hasStoredKey === 'true') {
            // If we already have the stored key in memory, use it
            if (input.dataset.storedKey) {
                console.log(`🔑 Using cached stored key for ${provider}`);
                input.value = input.dataset.storedKey;
                input.placeholder = 'Edit your API key';
            } else {
                // Fetch the stored key from backend
                console.log(`🔍 Fetching stored key for editing ${provider}...`);
                try {
                    const storedKey = await this.fetchStoredApiKey(provider);
                    if (storedKey) {
                        console.log(`✅ Retrieved stored key for editing ${provider}`);
                        input.value = storedKey;
                        input.dataset.storedKey = storedKey; // Cache it for future use
                        input.placeholder = 'Edit your API key';
                    } else {
                        console.log(`⚠️ No stored key found for ${provider}, allowing new entry`);
                        input.placeholder = 'Enter your API key';
                    }
                } catch (error) {
                    console.error(`❌ Error fetching stored key for ${provider}:`, error);
                    input.placeholder = 'Enter your API key';
                    this.showApiKeyMessage(provider, 'Failed to load stored key. You can enter a new one.', 'warning');
                }
            }
        } else {
            // No stored key, ready for new entry
            console.log(`📝 No stored key for ${provider}, ready for new entry`);
            input.value = '';
            input.placeholder = 'Enter your API key';
        }

        // Focus and select after a small delay to ensure value is set
        setTimeout(() => {
            input.focus();
        }, 50);

        // Show appropriate message
        const message = input.dataset.hasStoredKey === 'true'
            ? 'Input is now editable. Modify your API key and save settings.'
            : 'Input is now editable. Enter your API key and save settings.';
        this.showApiKeyMessage(provider, message, 'info');
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

            const response = await fetch(Config.getApiUrl('upload-resume'), {
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

                // Check resume skills after successful upload
                setTimeout(() => {
                    this.checkResumeStatus();
                }, 1000);
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
        document.getElementById('userEmail').value = this.userProfile.email || '';
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

            // If we already have stored skills, display them immediately
            if (this.userProfile.resumeSkills && this.userProfile.resumeSkills.length > 0) {
                this.displayStoredResumeSkills();
            }
        }

        // Check resume skills status (this will refresh/fetch if needed)
        this.checkResumeStatus();
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
            email: document.getElementById('userEmail').value,
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
            const response = await fetch(Config.getApiUrl('user-profile'), {
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
            const response = await fetch(Config.getApiUrl('test-email'), {
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

    // ==================== AI SETTINGS METHODS ====================

    // Handle AI provider selection change
    handleAiProviderChange(provider) {
        const openaiGroup = document.getElementById('openaiKeyGroup');
        const groqGroup = document.getElementById('groqKeyGroup');
        const testBtn = document.getElementById('testAiBtn');
        const saveBtn = document.getElementById('saveAiBtn');

        // Hide all API key groups
        openaiGroup.style.display = 'none';
        groqGroup.style.display = 'none';

        // Show relevant API key group
        if (provider === 'openai') {
            openaiGroup.style.display = 'block';
            // Load status for OpenAI
            this.loadApiKeyStatus('openai');
        } else if (provider === 'groq') {
            groqGroup.style.display = 'block';
            // Load status for Groq
            this.loadApiKeyStatus('groq');
        }

        // Enable/disable buttons based on selection
        const hasProvider = provider !== '';
        testBtn.disabled = !hasProvider;
        saveBtn.disabled = !hasProvider;

        // Note: Removed loadAiSettings() call to prevent circular loading
        // AI settings are loaded once during init() and when explicitly needed
    }

    // Update temperature slider value display
    updateTemperatureValue(value) {
        document.getElementById('temperatureValue').textContent = value;
    }

    // Test AI connection
    async testAiConnection() {
        const provider = document.getElementById('aiProvider').value;
        const testResult = document.getElementById('aiTestResult');

        if (!provider) {
            this.showNotification('Please select an AI provider first', 'error');
            return;
        }

        let apiKey = '';
        const keyInput = document.getElementById(`${provider}ApiKey`);

        // Get the API key from input or from user-entered data if hidden
        if (keyInput.type === 'text' && keyInput.value) {
            apiKey = keyInput.value;
        } else if (keyInput.type === 'password' && keyInput.dataset.userEnteredKey) {
            apiKey = keyInput.dataset.userEnteredKey;
        } else if (keyInput.value) {
            apiKey = keyInput.value;
        }

        // If no key in input, check if we have a stored key
        if (!apiKey && keyInput.dataset.hasStoredKey === 'true') {
            try {
                apiKey = await this.fetchStoredApiKey(provider);
            } catch (error) {
                console.error('Error fetching stored key for test:', error);
            }
        }

        if (!apiKey) {
            this.showNotification('Please enter an API key first', 'error');
            return;
        }

        // Show loading state
        testResult.style.display = 'block';
        testResult.className = 'test-result loading';
        testResult.innerHTML = '🔄 Testing AI connection...';

        // Update status indicator
        this.setApiKeyTestingStatus(provider, true);

        try {
            const response = await fetch(Config.getApiUrl('test-ai'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: provider,
                    api_key: apiKey
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                testResult.className = 'test-result success';
                testResult.innerHTML = `✅ Connection successful! Model: ${result.model || 'N/A'}`;
                this.showNotification('AI connection test successful!', 'success');

                // Update status to show key is valid (without revealing any key data)
                this.updateApiKeyStatus(provider, true);
            } else {
                testResult.className = 'test-result error';
                testResult.innerHTML = `❌ Connection failed: ${result.error || 'Unknown error'}`;
                this.showNotification('AI connection test failed', 'error');

                // Restore previous status
                this.loadApiKeyStatus(provider);
            }
        } catch (error) {
            console.error('AI test error:', error);
            testResult.className = 'test-result error';
            testResult.innerHTML = `❌ Connection failed: ${error.message}`;
            this.showNotification('AI connection test failed', 'error');

            // Restore previous status
            this.loadApiKeyStatus(provider);
        }
    }

    // Save AI settings
    async saveAiSettings() {
        const provider = document.getElementById('aiProvider').value;

        if (!provider) {
            this.showNotification('Please select an AI provider', 'error');
            return;
        }

        let apiKey = '';
        const keyInput = document.getElementById(`${provider}ApiKey`);

        console.log(`🔍 saveAiSettings: Determining API key for ${provider}`);
        console.log(`📊 Input state:`, {
            type: keyInput.type,
            value: keyInput.value ? '[PRESENT]' : '[EMPTY]',
            readonly: keyInput.hasAttribute('readonly'),
            userEnteredKey: keyInput.dataset.userEnteredKey ? '[PRESENT]' : '[EMPTY]',
            hasStoredKey: keyInput.dataset.hasStoredKey,
            storedKey: keyInput.dataset.storedKey ? '[PRESENT]' : '[EMPTY]',
            showingStoredKey: keyInput.dataset.showingStoredKey
        });

        // Get the API key from various sources
        if (keyInput.dataset.userEnteredKey) {
            // User has entered a new key
            apiKey = keyInput.dataset.userEnteredKey;
            console.log(`✅ Using userEnteredKey: "${apiKey}"`);
        } else if (keyInput.type === 'text' && keyInput.value) {
            // Key is currently visible (typed or shown)
            apiKey = keyInput.value;
            console.log(`✅ Using visible input value: "${apiKey}"`);
        } else if (keyInput.type === 'password' && keyInput.value) {
            // Key is masked but present
            apiKey = keyInput.value;
            console.log(`✅ Using password input value: "${apiKey}"`);
        } else if (keyInput.dataset.hasStoredKey === 'true' && keyInput.dataset.storedKey) {
            // Use the stored key if no new key entered
            apiKey = keyInput.dataset.storedKey;
            console.log(`✅ Using stored key: "${apiKey}"`);
        }

        if (!apiKey) {
            console.log(`❌ No API key found for ${provider}!`);
            this.showNotification('Please enter an API key or load a stored one', 'error');
            return;
        }

        console.log(`📦 Final API key to save for ${provider}: "${apiKey}"`);

        const aiSettings = {
            provider: provider,
            api_key: apiKey,
            temperature: parseFloat(document.getElementById('temperature').value),
            max_tokens: parseInt(document.getElementById('maxTokens').value),
            enable_optimizations: document.getElementById('enableAiOptimizations').checked
        };

        console.log(`📤 Sending AI settings to backend:`, {
            provider: aiSettings.provider,
            api_key: aiSettings.api_key ? '[PRESENT]' : '[EMPTY]',
            temperature: aiSettings.temperature,
            max_tokens: aiSettings.max_tokens,
            enable_optimizations: aiSettings.enable_optimizations
        });

        this.showLoading('Saving AI settings...');

        try {
            const response = await fetch(Config.getApiUrl('ai-settings'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(aiSettings)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showNotification('AI settings saved successfully!', 'success');

                // Reset save button to normal state
                const saveBtn = document.getElementById('saveAiBtn');
                if (saveBtn) {
                    saveBtn.style.background = '';
                    saveBtn.style.color = '';
                    saveBtn.textContent = '💾 Save AI Settings';
                }

                // Update the stored key data
                keyInput.dataset.storedKey = apiKey;
                keyInput.dataset.hasStoredKey = 'true';
                keyInput.dataset.userEnteredKey = '';
                keyInput.classList.add('has-stored-key');

                // Reset input to readonly and masked state
                keyInput.setAttribute('readonly', 'readonly');
                keyInput.type = 'password';
                keyInput.value = '';
                keyInput.placeholder = '••••••••••••••••••••';
                keyInput.dataset.showingStoredKey = 'false';

                // Update button states
                const editBtn = document.getElementById(`${provider}EditKeyBtn`);
                const toggleBtn = document.getElementById(`${provider}ToggleBtn`);

                if (editBtn) {
                    editBtn.disabled = false;
                    editBtn.textContent = '✏️';
                    editBtn.title = 'Edit API key';
                }

                if (toggleBtn) {
                    toggleBtn.disabled = false;
                    toggleBtn.textContent = '👁️';
                    toggleBtn.title = 'Show API key';
                    toggleBtn.classList.remove('showing');
                }

                // Update status to show key is stored
                this.updateApiKeyStatus(provider, true);

                // Make input readonly after successful save
                keyInput.setAttribute('readonly', 'readonly');
                keyInput.classList.remove('editing');
                keyInput.type = 'password';
                keyInput.placeholder = '••••••••••••••••••••';

                this.markAsSaved();
            } else {
                this.showNotification(`Failed to save AI settings: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Save AI settings error:', error);
            this.showNotification('Failed to save AI settings', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Load AI settings
    async loadAiSettings() {
        const now = Date.now();

        // Prevent concurrent loading
        if (this.isLoadingAiSettings) {
            console.log('AI settings already loading, skipping...');
            return;
        }

        // Debounce rapid successive calls
        if (now - this.lastAiSettingsLoad < this.AI_SETTINGS_DEBOUNCE_MS) {
            console.log('AI settings load debounced, too soon since last load');
            return;
        }

        console.log('Loading AI settings...');
        this.isLoadingAiSettings = true;
        this.lastAiSettingsLoad = now;

        try {
            const response = await fetch(Config.getApiUrl('ai-settings'));

            if (response.ok) {
                const result = await response.json();

                if (result.success && result.settings) {
                    const settings = result.settings;
                    console.log('Successfully loaded AI settings:', settings);                    // Set provider (but avoid triggering handleAiProviderChange recursively)
                    if (settings.provider) {
                        const providerSelect = document.getElementById('aiProvider');
                        if (providerSelect.value !== settings.provider) {
                            console.log(`Setting provider to: ${settings.provider}`);
                            // Temporarily remove event listener to prevent recursive calls
                            const originalHandler = providerSelect.onchange;
                            providerSelect.onchange = null;

                            providerSelect.value = settings.provider;
                            this.handleAiProviderChange(settings.provider);

                            // Restore event listener
                            providerSelect.onchange = originalHandler;
                        }

                        // Load and display stored API key status for the current provider
                        await this.loadApiKeyStatus(settings.provider);
                    }

                    // Always load status for both providers to ensure proper initialization
                    await this.loadApiKeyStatus('openai');
                    await this.loadApiKeyStatus('groq');

                    // Set model parameters
                    if (settings.temperature !== undefined) {
                        const tempSlider = document.getElementById('temperature');
                        tempSlider.value = settings.temperature;
                        this.updateTemperatureValue(settings.temperature);
                    }

                    if (settings.max_tokens !== undefined) {
                        document.getElementById('maxTokens').value = settings.max_tokens;
                    }

                    if (settings.enable_optimizations !== undefined) {
                        document.getElementById('enableAiOptimizations').checked = settings.enable_optimizations;
                    }

                    // Enable buttons if provider is set
                    if (settings.provider) {
                        document.getElementById('testAiBtn').disabled = false;
                        document.getElementById('saveAiBtn').disabled = false;
                    }
                } else {
                    console.log('No AI settings found, initializing inputs with default state');
                }
            } else {
                console.log('Failed to load AI settings, initializing inputs with default state');
            }

            // Always load status for both providers to ensure proper initialization
            await this.loadApiKeyStatus('openai');
            await this.loadApiKeyStatus('groq');
        } catch (error) {
            console.error('Load AI settings error:', error);

            // On error, still try to initialize both inputs
            await this.loadApiKeyStatus('openai');
            await this.loadApiKeyStatus('groq');
        } finally {
            this.isLoadingAiSettings = false;
        }
    }

    // Clear all AI keys
    async clearAiKeys() {
        if (!confirm('Are you sure you want to clear all AI API keys? This action cannot be undone.')) {
            return;
        }

        this.showLoading('Clearing AI keys...');

        try {
            const response = await fetch(Config.getApiUrl('ai-settings'), {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Clear form
                document.getElementById('aiProvider').value = '';
                document.getElementById('openaiApiKey').value = '';
                document.getElementById('groqApiKey').value = '';
                this.handleAiProviderChange('');

                // Reset all status indicators
                this.updateApiKeyStatus('openai', false);
                this.updateApiKeyStatus('groq', false);

                // Hide test result
                document.getElementById('aiTestResult').style.display = 'none';

                this.showNotification('AI keys cleared successfully', 'success');
            } else {
                this.showNotification(`Failed to clear AI keys: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Clear AI keys error:', error);
            this.showNotification('Failed to clear AI keys', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Load and display API key status for a provider
    async loadApiKeyStatus(provider) {
        try {
            console.log(`Loading API key status for ${provider}...`);

            // Check if we have a stored key for this provider
            const response = await fetch(Config.getApiUrl(`ai-settings/key-status?provider=${provider}`));

            if (response.ok) {
                const result = await response.json();
                this.updateApiKeyStatus(provider, result.hasKey, result.keyPreview);

                // Update input state based on key status
                const input = document.getElementById(`${provider}ApiKey`);
                const editBtn = document.getElementById(`${provider}EditKeyBtn`);
                const toggleBtn = document.getElementById(`${provider}ToggleBtn`);

                if (input && result.hasKey) {
                    console.log(`Setting ${provider} input to stored key state`);
                    input.dataset.hasStoredKey = 'true';
                    input.classList.add('has-stored-key');
                    input.setAttribute('readonly', 'readonly');
                    input.type = 'password';
                    input.value = '';
                    input.placeholder = '••••••••••••••••••••';
                    input.dataset.showingStoredKey = 'false';
                    input.dataset.userEnteredKey = '';

                    if (editBtn) {
                        editBtn.disabled = false;
                        editBtn.textContent = '✏️';
                    }
                    if (toggleBtn) {
                        toggleBtn.disabled = false;
                        toggleBtn.textContent = '👁️';
                    }
                } else if (input) {
                    console.log(`Setting ${provider} input to no-key state`);
                    input.dataset.hasStoredKey = 'false';
                    input.classList.remove('has-stored-key');
                    input.removeAttribute('readonly');
                    input.type = 'password';
                    input.value = '';
                    input.placeholder = 'Enter your API key';
                    input.dataset.showingStoredKey = 'false';
                    input.dataset.userEnteredKey = '';

                    if (editBtn) {
                        editBtn.disabled = true;
                        editBtn.textContent = '✏️';
                    }
                    if (toggleBtn) {
                        toggleBtn.disabled = true;
                        toggleBtn.textContent = '👁️';
                    }
                }
            } else {
                // Fallback: check if we can get provider settings
                const settingsResponse = await fetch(Config.getApiUrl('ai-settings'));
                if (settingsResponse.ok) {
                    const settingsResult = await settingsResponse.json();
                    const hasKey = settingsResult.settings && settingsResult.settings.provider === provider;
                    this.updateApiKeyStatus(provider, hasKey);
                }
            }
        } catch (error) {
            console.error(`Error loading API key status for ${provider}:`, error);

            // Set input to default no-key state on error
            const input = document.getElementById(`${provider}ApiKey`);
            if (input) {
                console.log(`Setting ${provider} input to default no-key state due to error`);
                input.dataset.hasStoredKey = 'false';
                input.classList.remove('has-stored-key');
                input.removeAttribute('readonly');
                input.type = 'password';
                input.value = '';
                input.placeholder = 'Enter your API key';
                input.dataset.showingStoredKey = 'false';
                input.dataset.userEnteredKey = '';
            }

            this.updateApiKeyStatus(provider, false);
        }
    }

    // Update API key status display
    updateApiKeyStatus(provider, hasKey, keyPreview = null) {
        const statusContainer = document.getElementById(`${provider}KeyStatus`);
        const statusIndicator = document.getElementById(`${provider}StatusIndicator`);
        const statusText = document.getElementById(`${provider}StatusText`);
        const keyInput = document.getElementById(`${provider}ApiKey`);

        if (!statusContainer) return;

        // Remove all status classes
        statusContainer.classList.remove('stored', 'not-stored', 'testing');
        statusIndicator.classList.remove('stored', 'not-stored', 'testing');

        if (hasKey) {
            // Key is stored
            statusContainer.classList.add('stored');
            statusIndicator.classList.add('stored');
            statusText.textContent = 'API key stored and encrypted';

            // Mark input as having a stored key but don't show any preview
            keyInput.classList.add('has-stored-key');
            keyInput.dataset.hasStoredKey = 'true';

            // Only show placeholder dots when input is empty and hidden
            if (!keyInput.value && keyInput.type === 'password') {
                keyInput.placeholder = '••••••••••••••••••••';
            }
        } else {
            // No key stored
            statusContainer.classList.add('not-stored');
            statusIndicator.classList.add('not-stored');
            statusText.textContent = 'No API key stored';
            keyInput.classList.remove('has-stored-key');
            keyInput.dataset.hasStoredKey = 'false';
            keyInput.placeholder = 'Enter your API key';
        }
    }

    // Set testing status for API key
    setApiKeyTestingStatus(provider, isTesting = true) {
        const statusContainer = document.getElementById(`${provider}KeyStatus`);
        const statusIndicator = document.getElementById(`${provider}StatusIndicator`);
        const statusText = document.getElementById(`${provider}StatusText`);

        if (!statusContainer) return;

        if (isTesting) {
            statusContainer.classList.remove('stored', 'not-stored');
            statusContainer.classList.add('testing');
            statusIndicator.classList.remove('stored', 'not-stored');
            statusIndicator.classList.add('testing');
            statusText.textContent = 'Testing API key...';
        }
    }

    // ==================== API KEY MANAGEMENT FUNCTIONS ====================

    // Global function for loading stored API key
    async loadStoredApiKey(provider) {
        console.log(`📥 Loading stored API key for provider: ${provider}`);

        const input = document.getElementById(`${provider}ApiKey`);
        const loadBtn = document.getElementById(`${provider}LoadKeyBtn`);
        const editBtn = document.getElementById(`${provider}EditKeyBtn`);
        const toggleBtn = document.getElementById(`${provider}ToggleBtn`);

        if (!input || !loadBtn) {
            console.error(`❌ Required elements not found for ${provider}`);
            return;
        }

        // Show loading state
        const originalText = loadBtn.textContent;
        loadBtn.textContent = '⏳';
        loadBtn.disabled = true;

        try {
            const response = await fetch(Config.getApiUrl('ai-settings/get-key'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ provider: provider })
            });

            const result = await response.json();

            if (result.success && result.apiKey) {
                console.log(`✅ Successfully loaded API key for ${provider}`);

                // Store the key in dataset but don't show it yet
                input.dataset.storedKey = result.apiKey;
                input.dataset.hasStoredKey = 'true';
                input.dataset.showingStoredKey = 'false';
                input.dataset.userEnteredKey = ''; // Clear any user-entered key
                input.classList.add('has-stored-key');

                // Make input readonly and masked
                input.setAttribute('readonly', 'readonly');
                input.classList.remove('editing');
                input.type = 'password';
                input.value = '';
                input.placeholder = '••••••••••••••••••••';

                // Update button states
                if (editBtn) {
                    editBtn.disabled = false;
                    editBtn.textContent = '✏️';
                    editBtn.title = 'Edit API key';
                }
                if (toggleBtn) {
                    toggleBtn.disabled = false;
                    toggleBtn.textContent = '👁️';
                    toggleBtn.title = 'Show API key';
                    toggleBtn.classList.remove('showing');
                }

                // Update status
                this.updateApiKeyStatus(provider, true);
                this.showApiKeyMessage(provider, 'API key loaded successfully', 'success');

            } else {
                console.log(`⚠️ No API key found for ${provider}`);

                // Clear stored key info
                input.dataset.storedKey = '';
                input.dataset.hasStoredKey = 'false';
                input.classList.remove('has-stored-key');
                input.placeholder = 'Enter your API key';

                // Update status and message
                this.updateApiKeyStatus(provider, false);
                this.showApiKeyMessage(provider, 'No stored API key found', 'warning');
            }

        } catch (error) {
            console.error(`❌ Error loading API key for ${provider}:`, error);
            this.showApiKeyMessage(provider, 'Failed to load API key', 'error');
        } finally {
            // Reset load button
            loadBtn.textContent = originalText;
            loadBtn.disabled = false;
        }
    }

    // Helper function to show API key messages
    showApiKeyMessage(provider, message, type = 'info') {
        const statusText = document.getElementById(`${provider}StatusText`);
        if (statusText) {
            const originalText = statusText.textContent;
            statusText.textContent = message;

            // Reset after 3 seconds
            setTimeout(() => {
                statusText.textContent = originalText;
            }, 3000);
        }

        // Also show in main notification system for important messages
        if (type === 'error' || type === 'success') {
            this.showNotification(message, type);
        }
    }

    // Setup API key button event listeners
    setupApiKeyButtonListeners() {
        // Load key buttons
        document.getElementById('openaiLoadKeyBtn')?.addEventListener('click', () => {
            this.loadStoredApiKey('openai');
        });

        document.getElementById('groqLoadKeyBtn')?.addEventListener('click', () => {
            this.loadStoredApiKey('groq');
        });

        // Edit key buttons - now just make input editable
        document.getElementById('openaiEditKeyBtn')?.addEventListener('click', async () => {
            await this.makeInputEditable('openaiApiKey');
        });

        document.getElementById('groqEditKeyBtn')?.addEventListener('click', async () => {
            await this.makeInputEditable('groqApiKey');
        });

        // Toggle visibility buttons
        document.getElementById('openaiToggleBtn')?.addEventListener('click', async () => {
            await this.toggleApiKeyVisibility('openaiApiKey');
        });

        document.getElementById('groqToggleBtn')?.addEventListener('click', async () => {
            await this.toggleApiKeyVisibility('groqApiKey');
        });
    }

    // Toggle API key visibility (instance method)
    async toggleApiKeyVisibility(inputId) {
        console.log(`🔄 Toggle called for: ${inputId}`);

        const input = document.getElementById(inputId);
        const provider = inputId.replace('ApiKey', '');
        const button = document.getElementById(`${provider}ToggleBtn`); // Use ID instead of querySelector

        if (!input) {
            console.error(`❌ Input element not found: ${inputId}`);
            return;
        }

        if (!button) {
            console.error(`❌ Toggle button not found for: ${inputId}`);
            return;
        }

        console.log(`📊 Current state - Type: ${input.type}, HasStoredKey: ${input.dataset.hasStoredKey}, Value: ${input.value ? '[PRESENT]' : '[EMPTY]'}, Readonly: ${input.hasAttribute('readonly')}`);

        if (input.type === 'password') {
            // Show mode: reveal the API key
            console.log(`👁️ Switching to show mode for ${inputId}`);
            input.type = 'text';
            button.textContent = '🙈';
            button.title = 'Hide API key';
            button.classList.add('showing');

            // If input is empty but we have a stored key, fetch and show it
            if (!input.value && input.dataset.hasStoredKey === 'true') {
                if (input.dataset.storedKey) {
                    console.log(`🔑 Showing cached stored key for ${inputId}`);
                    input.value = input.dataset.storedKey;
                    input.dataset.showingStoredKey = 'true';
                } else {
                    // Fetch the stored key if we don't have it in memory
                    console.log(`🔍 Fetching stored key for display...`);
                    try {
                        const key = await this.fetchStoredApiKey(provider);
                        if (key && input.type === 'text') { // Check if still in text mode
                            input.value = key;
                            input.dataset.storedKey = key; // Cache it
                            input.dataset.showingStoredKey = 'true';
                            console.log(`🔓 Stored key displayed for ${provider}`);
                        }
                    } catch (error) {
                        console.error(`❌ Error fetching stored API key for ${provider}:`, error);
                        this.showApiKeyMessage(provider, 'Failed to load stored key', 'error');
                    }
                }
            } else if (input.value) {
                console.log(`📝 Showing existing value for ${inputId}`);
            }
        } else {
            // Hide mode: mask the API key
            console.log(`🙈 Switching to hide mode for ${inputId}`);
            input.type = 'password';
            button.textContent = '👁️';
            button.title = 'Show API key';
            button.classList.remove('showing');

            // If showing a stored key, clear it and reset
            if (input.dataset.showingStoredKey === 'true') {
                console.log(`🧹 Clearing stored key from display for ${inputId}`);
                input.value = '';
                input.dataset.showingStoredKey = 'false';
                input.placeholder = '••••••••••••••••••••';
            }
            // If user has entered a new key, preserve it in dataset AND keep the value
            else if (input.value) {
                console.log(`💾 Preserving user-entered key for ${inputId}`);
                // Ensure userEnteredKey is set to current value
                input.dataset.userEnteredKey = input.value;
                console.log(`💾 userEnteredKey preserved as: "${input.dataset.userEnteredKey}"`);
                // Keep the value in the input (password type will mask it)
            }
        }

        console.log(`✅ Toggle complete for ${inputId} - New type: ${input.type}`);
    }

    // Helper method to fetch stored API key
    async fetchStoredApiKey(provider) {
        console.log(`🔍 Fetching stored API key for provider: ${provider}`);

        try {
            const response = await fetch(Config.getApiUrl('ai-settings/get-key'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ provider: provider })
            });

            console.log(`📡 API response status: ${response.status}`);

            if (response.ok) {
                const result = await response.json();
                console.log(`📄 API response data:`, {
                    success: result.success,
                    hasApiKey: !!result.apiKey
                });

                if (result.success && result.apiKey) {
                    console.log(`✅ Found stored key for ${provider}`);
                    return result.apiKey;
                } else {
                    console.log(`⚠️ No API key found: ${result.error || 'Unknown error'}`);
                }
            } else {
                console.error(`❌ API request failed with status: ${response.status}`);
            }
        } catch (error) {
            console.error(`❌ Network error fetching stored API key:`, error);
        }

        console.log(`❌ No stored key found for ${provider}`);
        return null;
    }

    // Show notification message
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');

        if (notification && notificationText) {
            // Set message and type
            notificationText.textContent = message;
            notification.className = `notification ${type}`;
            notification.style.display = 'block';

            // Auto-hide after 5 seconds for success/info messages
            if (type === 'success' || type === 'info') {
                setTimeout(() => {
                    this.hideNotification();
                }, 5000);
            }

            console.log(`📢 Notification shown: [${type.toUpperCase()}] ${message}`);
        } else {
            console.error('❌ Notification elements not found in DOM');
        }
    }

    // Hide notification
    hideNotification() {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.style.display = 'none';
            notification.className = 'notification';
        }
    }

    // Show loading state
    showLoading(message = 'Loading...') {
        // You can implement a loading spinner/overlay here if needed
        console.log(`🔄 Loading: ${message}`);
    }

    // Hide loading state
    hideLoading() {
        // Hide loading spinner/overlay
        console.log('✅ Loading complete');
    }

    // Setup resume skills listeners
    setupResumeSkillsListeners() {
        const refreshBtn = document.getElementById('refreshResumeBtn');
        const viewBtn = document.getElementById('viewResumeBtn');
        const syncBtn = document.getElementById('syncSkillsBtn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.checkResumeStatus());
        }

        if (viewBtn) {
            viewBtn.addEventListener('click', () => this.viewResumeDetails());
        }

        if (syncBtn) {
            syncBtn.addEventListener('click', () => this.syncResumeSkillsToField());
        }
    }

    // Check resume status and skills
    async checkResumeStatus() {
        console.log('🔍 Checking resume status...');

        const resumeStatusTitle = document.getElementById('resumeStatusTitle');
        const resumeStatusMessage = document.getElementById('resumeStatusMessage');
        const resumeSkillsList = document.getElementById('resumeSkillsList');
        const skillsTags = document.getElementById('skillsTags');
        const skillsCount = document.getElementById('skillsCount');
        const viewBtn = document.getElementById('viewResumeBtn');
        const refreshBtn = document.getElementById('refreshResumeBtn');
        const statusCard = document.querySelector('.resume-status-card');

        if (!this.userProfile || !this.userProfile.resumeUrl) {
            // No resume uploaded
            resumeStatusTitle.textContent = 'No Resume Uploaded';
            resumeStatusMessage.textContent = 'Upload a resume to extract skills for better job matching';
            resumeSkillsList.style.display = 'none';
            viewBtn.style.display = 'none';
            statusCard.className = 'resume-status-card no-resume';
            return;
        }

        // Show loading state
        refreshBtn.disabled = true;
        refreshBtn.textContent = '🔄 Analyzing...';
        resumeStatusMessage.textContent = 'Analyzing resume skills...';
        statusCard.className = 'resume-status-card';

        try {
            // Parse the resume to get skills
            const response = await fetch(Config.getApiUrl('parse-resume'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    file_path: this.userProfile.resumeUrl
                })
            });

            const result = await response.json();

            if (result.success) {
                // Update status to success
                resumeStatusTitle.textContent = 'Resume Skills Extracted';
                resumeStatusMessage.textContent = `Found ${result.skill_count || 0} skills from your resume`;
                statusCard.className = 'resume-status-card has-resume';

                // Display skills
                if (result.skills && result.skills.length > 0) {
                    this.displaySkills(result.skills, skillsTags, skillsCount);
                    resumeSkillsList.style.display = 'block';
                    viewBtn.style.display = 'inline-block';
                    document.getElementById('syncSkillsBtn').style.display = 'inline-block';

                    // Store the parsed skills in user profile for future use
                    this.userProfile.resumeSkills = result.skills;
                    this.userProfile.resumeSkillsByCategory = result.skills_by_category;
                    this.userProfile.resumeContactInfo = result.contact_info;
                    await this.saveUserProfile();

                    this.showNotification(`Successfully extracted ${result.skill_count} skills from your resume!`, 'success');
                } else {
                    resumeStatusMessage.textContent = 'No technical skills found in resume';
                    resumeSkillsList.style.display = 'none';
                    viewBtn.style.display = 'none';
                    document.getElementById('syncSkillsBtn').style.display = 'none';
                    this.showNotification('No technical skills found in the resume', 'warning');
                }
            } else {
                // Error parsing resume
                resumeStatusTitle.textContent = 'Resume Analysis Failed';
                resumeStatusMessage.textContent = result.error || 'Could not analyze resume';
                resumeSkillsList.style.display = 'none';
                viewBtn.style.display = 'none';
                document.getElementById('syncSkillsBtn').style.display = 'none';
                statusCard.className = 'resume-status-card error';
                this.showNotification(`Resume analysis failed: ${result.error}`, 'error');
            }

        } catch (error) {
            console.error('Error checking resume status:', error);
            resumeStatusTitle.textContent = 'Analysis Error';
            resumeStatusMessage.textContent = 'Failed to analyze resume. Please try again.';
            resumeSkillsList.style.display = 'none';
            viewBtn.style.display = 'none';
            document.getElementById('syncSkillsBtn').style.display = 'none';
            statusCard.className = 'resume-status-card error';
            this.showNotification('Failed to analyze resume. Please check your connection and try again.', 'error');
        } finally {
            // Reset button state
            refreshBtn.disabled = false;
            refreshBtn.textContent = '🔄 Refresh Status';
        }
    }

    // Display skills tags
    displaySkills(skills, container, countElement) {
        // Clear existing skills
        container.innerHTML = '';

        // Display up to 15 skills (to avoid overcrowding)
        const displaySkills = skills.slice(0, 15);

        displaySkills.forEach(skill => {
            const skillTag = document.createElement('span');
            skillTag.className = 'skill-tag';
            skillTag.textContent = skill;
            container.appendChild(skillTag);
        });

        // Update count
        countElement.textContent = skills.length;

        // Show "and X more..." if there are more skills
        if (skills.length > 15) {
            const moreTag = document.createElement('span');
            moreTag.className = 'skill-tag skill-tag-more';
            moreTag.textContent = `+${skills.length - 15} more`;
            container.appendChild(moreTag);
        }
    }

    // View detailed resume information
    viewResumeDetails() {
        if (!this.userProfile || !this.userProfile.resumeSkills) {
            this.showNotification('No resume skills data available', 'warning');
            return;
        }

        // Create modal for detailed view
        const modal = this.createResumeDetailsModal();
        document.body.appendChild(modal);

        // Setup modal close functionality
        const closeBtn = modal.querySelector('.modal-close');
        const overlay = modal.querySelector('.modal-overlay');

        closeBtn.addEventListener('click', () => modal.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) modal.remove();
        });

        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    // Create resume details modal
    createResumeDetailsModal() {
        const skills = this.userProfile.resumeSkills || [];
        const skillsByCategory = this.userProfile.resumeSkillsByCategory || {};
        const contactInfo = this.userProfile.resumeContactInfo || {};

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>📄 Resume Details</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="resume-detail-section">
                        <h3>📊 Skills Summary</h3>
                        <p>Total Skills Found: <strong>${skills.length}</strong></p>
                    </div>

                    ${Object.keys(skillsByCategory).length > 0 ? `
                        <div class="resume-detail-section">
                            <h3>🏷️ Skills by Category</h3>
                            ${Object.entries(skillsByCategory).map(([category, categorySkills]) =>
            categorySkills.length > 0 ? `
                                    <div class="skill-category">
                                        <h4>${this.formatCategoryName(category)}</h4>
                                        <div class="skills-tags">
                                            ${categorySkills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                                        </div>
                                    </div>
                                ` : ''
        ).join('')}
                        </div>
                    ` : ''}

                    ${Object.keys(contactInfo).some(key => contactInfo[key]) ? `
                        <div class="resume-detail-section">
                            <h3>📞 Contact Information Found</h3>
                            <div class="contact-info">
                                ${contactInfo.email ? `<p><strong>Email:</strong> ${contactInfo.email}</p>` : ''}
                                ${contactInfo.phone ? `<p><strong>Phone:</strong> ${contactInfo.phone}</p>` : ''}
                                ${contactInfo.linkedin ? `<p><strong>LinkedIn:</strong> ${contactInfo.linkedin}</p>` : ''}
                                ${contactInfo.github ? `<p><strong>GitHub:</strong> ${contactInfo.github}</p>` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <div class="resume-detail-section">
                        <h3>🔧 All Skills</h3>
                        <div class="skills-tags">
                            ${skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline modal-close">Close</button>
                </div>
            </div>
        `;

        return modal;
    }

    // Sync resume skills to manual skills field
    syncResumeSkillsToField() {
        if (!this.userProfile || !this.userProfile.resumeSkills || this.userProfile.resumeSkills.length === 0) {
            this.showNotification('No resume skills available to sync', 'warning');
            return;
        }

        const skillsField = document.getElementById('skills');
        if (!skillsField) {
            this.showNotification('Skills field not found', 'error');
            return;
        }

        // Get current skills and remove duplicates
        const currentSkills = skillsField.value ? skillsField.value.split(',').map(s => s.trim()).filter(s => s) : [];
        const resumeSkills = this.userProfile.resumeSkills;

        // Merge skills (resume skills + current skills, removing duplicates)
        const allSkills = [...new Set([...resumeSkills, ...currentSkills])];

        // Update the field
        skillsField.value = allSkills.join(', ');

        // Show success message
        this.showNotification(`Synced ${resumeSkills.length} skills from resume to skills field!`, 'success');

        // Highlight the field briefly
        skillsField.style.borderColor = '#28a745';
        skillsField.style.boxShadow = '0 0 0 0.2rem rgba(40, 167, 69, 0.25)';

        setTimeout(() => {
            skillsField.style.borderColor = '';
            skillsField.style.boxShadow = '';
        }, 2000);
    }

    // Display stored resume skills immediately (before fresh check)
    displayStoredResumeSkills() {
        const resumeStatusTitle = document.getElementById('resumeStatusTitle');
        const resumeStatusMessage = document.getElementById('resumeStatusMessage');
        const resumeSkillsList = document.getElementById('resumeSkillsList');
        const skillsTags = document.getElementById('skillsTags');
        const skillsCount = document.getElementById('skillsCount');
        const viewBtn = document.getElementById('viewResumeBtn');
        const statusCard = document.querySelector('.resume-status-card');

        if (this.userProfile.resumeSkills && this.userProfile.resumeSkills.length > 0) {
            resumeStatusTitle.textContent = 'Resume Skills Available';
            resumeStatusMessage.textContent = `${this.userProfile.resumeSkills.length} skills loaded from resume`;
            statusCard.className = 'resume-status-card has-resume';

            this.displaySkills(this.userProfile.resumeSkills, skillsTags, skillsCount);
            resumeSkillsList.style.display = 'block';
            viewBtn.style.display = 'inline-block';
            document.getElementById('syncSkillsBtn').style.display = 'inline-block';
        }
    }

    // Format category name for display
    formatCategoryName(category) {
        return category
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }


}

// Global controller instance
let optionsController;

// Initialize options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    optionsController = new OptionsController();
});
