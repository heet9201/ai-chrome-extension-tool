"""
AI Settings service for managing AI provider configurations
Handles secure storage and retrieval of API keys and settings
"""

import os
import json
from typing import Dict, Any, Optional
from datetime import datetime


class AISettingsService:
    """Service for managing AI provider settings"""
    
    def __init__(self):
        self.settings_file = os.path.join('backend', 'ai_settings.json')
        self.ensure_settings_file()
    
    def ensure_settings_file(self):
        """Ensure the settings file and directory exist"""
        try:
            # Ensure the directory exists
            settings_dir = os.path.dirname(self.settings_file)
            if not os.path.exists(settings_dir):
                os.makedirs(settings_dir, exist_ok=True)
                print(f"Created directory: {settings_dir}")
            
            # Ensure the file exists
            if not os.path.exists(self.settings_file):
                print(f"Creating AI settings file: {self.settings_file}")
                # Create an empty settings file with basic structure
                initial_settings = {
                    "last_updated": datetime.now().isoformat(),
                    "version": "1.0.0"
                }
                self.save_settings(initial_settings)
        except Exception as e:
            print(f"Error ensuring settings file: {str(e)}")
            # Try alternative path if the primary fails
            try:
                self.settings_file = os.path.join('backend', 'ai_settings.json')
                settings_dir = os.path.dirname(self.settings_file)
                if not os.path.exists(settings_dir):
                    os.makedirs(settings_dir, exist_ok=True)
                
                if not os.path.exists(self.settings_file):
                    print(f"Creating AI settings file at alternative location: {self.settings_file}")
                    initial_settings = {
                        "last_updated": datetime.now().isoformat(),
                        "version": "1.0.0"
                    }
                    self.save_settings(initial_settings)
            except Exception as e2:
                print(f"Error creating settings file at alternative location: {str(e2)}")
                # Final fallback - create in current directory
                self.settings_file = 'ai_settings.json'
                if not os.path.exists(self.settings_file):
                    print(f"Creating AI settings file in current directory: {self.settings_file}")
                    initial_settings = {
                        "last_updated": datetime.now().isoformat(),
                        "version": "1.0.0"
                    }
                    self.save_settings(initial_settings)
    
    def save_settings(self, settings: Dict[str, Any]) -> bool:
        """Save AI settings to file"""
        try:
            # Ensure directory exists before saving
            settings_dir = os.path.dirname(self.settings_file)
            if settings_dir and not os.path.exists(settings_dir):
                os.makedirs(settings_dir, exist_ok=True)
                print(f"Created directory for settings: {settings_dir}")
            
            settings['last_updated'] = datetime.now().isoformat()
            
            with open(self.settings_file, 'w') as f:
                json.dump(settings, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving AI settings: {str(e)}")
            return False
    
    def load_settings(self) -> Dict[str, Any]:
        """Load AI settings from file"""
        try:
            if not os.path.exists(self.settings_file):
                return {}
                
            with open(self.settings_file, 'r') as f:
                content = f.read().strip()
                if not content:
                    return {}
                return json.loads(content)
                
        except json.JSONDecodeError as e:
            print(f"Error parsing AI settings JSON: {str(e)}")
            return {}
        except FileNotFoundError:
            return {}
        except Exception as e:
            print(f"Error loading AI settings: {str(e)}")
            return {}
    
    def store_api_key(self, provider: str, api_key: str, additional_settings: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Store encrypted API key and settings
        
        Args:
            provider: AI provider name ('openai' or 'groq')
            api_key: The API key to encrypt and store
            additional_settings: Additional settings like temperature, max_tokens, etc.
            
        Returns:
            Dictionary with success status and error message if any
        """
        try:
            # Import crypto functions here to avoid circular imports
            from utils.crypto import encrypt_api_key, validate_api_key_format
            
            # Validate API key format
            if not validate_api_key_format(provider, api_key):
                return {
                    'success': False,
                    'error': f'Invalid API key format for {provider}'
                }
            
            # Load existing settings
            settings = self.load_settings()
            
            # Encrypt the API key
            encrypted_key = encrypt_api_key(api_key)
            
            # Store provider settings
            provider_settings = {
                'encrypted_api_key': encrypted_key,
                'last_updated': datetime.now().isoformat()
            }
            
            # Add additional settings if provided
            if additional_settings:
                provider_settings.update(additional_settings)
            
            # Update settings
            settings[provider] = provider_settings
            settings['active_provider'] = provider
            
            # Save to file
            if self.save_settings(settings):
                return {'success': True}
            else:
                return {
                    'success': False,
                    'error': 'Failed to save settings to file'
                }
                
        except ImportError as e:
            return {
                'success': False,
                'error': f'Error importing crypto module: {str(e)}'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error storing API key: {str(e)}'
            }
    
    def get_api_key(self, provider: str) -> Optional[str]:
        """
        Retrieve and decrypt API key for a provider
        
        Args:
            provider: AI provider name
            
        Returns:
            Decrypted API key or None if not found
        """
        try:
            settings = self.load_settings()
            if not settings:
                return None
                
            provider_settings = settings.get(provider, {})
            if not provider_settings:
                return None
            
            encrypted_key = provider_settings.get('encrypted_api_key')
            if not encrypted_key:
                return None
                
            # Import crypto here to avoid circular imports
            from utils.crypto import decrypt_api_key
            return decrypt_api_key(encrypted_key)
            
        except ImportError as e:
            print(f"Error importing crypto module: {str(e)}")
            return None
        except ValueError as e:
            print(f"Error decrypting API key for {provider}: {str(e)}")
            return None
        except Exception as e:
            print(f"Error retrieving API key for {provider}: {str(e)}")
            return None
    
    def get_provider_settings(self, provider: str = None) -> Dict[str, Any]:
        """
        Get settings for a specific provider or active provider
        
        Args:
            provider: Provider name, if None uses active provider
            
        Returns:
            Provider settings dictionary
        """
        try:
            settings = self.load_settings()
            
            if provider is None:
                provider = settings.get('active_provider')
            
            if provider and provider in settings:
                provider_settings = settings[provider].copy()
                # Don't return the encrypted key in settings
                provider_settings.pop('encrypted_api_key', None)
                provider_settings['provider'] = provider
                return provider_settings
            
            return {}
        except Exception as e:
            print(f"Error getting provider settings: {str(e)}")
            return {}
    
    def get_active_provider_config(self) -> Dict[str, Any]:
        """
        Get complete configuration for the active provider including decrypted API key
        
        Returns:
            Dictionary with provider, api_key, and other settings
        """
        try:
            settings = self.load_settings()
            if not settings:
                return {}
                
            active_provider = settings.get('active_provider')
            if not active_provider:
                return {}
            
            provider_settings = settings.get(active_provider, {})
            if not provider_settings:
                return {}
                
            api_key = self.get_api_key(active_provider)
            if not api_key:
                return {}
            
            config = {
                'provider': active_provider,
                'api_key': api_key
            }
            
            # Add other settings
            for key, value in provider_settings.items():
                if key not in ['encrypted_api_key', 'last_updated']:
                    config[key] = value
            
            return config
            
        except Exception as e:
            print(f"Error getting active provider config: {str(e)}")
            return {}
    
    def clear_provider_settings(self, provider: str = None) -> Dict[str, Any]:
        """
        Clear settings for a specific provider or all providers
        
        Args:
            provider: Provider name, if None clears all settings
            
        Returns:
            Dictionary with success status
        """
        try:
            settings = self.load_settings()
            
            if provider:
                # Clear specific provider
                if provider in settings:
                    del settings[provider]
                    
                # If this was the active provider, clear that too
                if settings.get('active_provider') == provider:
                    settings.pop('active_provider', None)
            else:
                # Clear all settings
                settings = {}
            
            if self.save_settings(settings):
                return {'success': True}
            else:
                return {
                    'success': False,
                    'error': 'Failed to save settings'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'Error clearing settings: {str(e)}'
            }
    
    def test_provider_connection(self, provider: str, api_key: str) -> Dict[str, Any]:
        """
        Test connection to AI provider
        
        Args:
            provider: Provider name
            api_key: API key to test
            
        Returns:
            Dictionary with test results
        """
        try:
            from services.ai_agent import JobAnalysisAgent
            
            # Create agent with test credentials
            agent = JobAnalysisAgent(provider=provider, api_key=api_key)
            
            # Test connection
            result = agent.test_connection()
            return result
            
        except ImportError as e:
            return {
                'success': False,
                'error': f'Failed to import AI agent: {str(e)}'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Connection test failed: {str(e)}'
            }

    def debug_settings(self) -> Dict[str, Any]:
        """
        Get debugging information about current settings
        
        Returns:
            Dictionary with debugging information
        """
        try:
            settings = self.load_settings()
            
            debug_info = {
                'settings_file_exists': os.path.exists(self.settings_file),
                'settings_file_path': self.settings_file,
                'total_providers': len([k for k in settings.keys() if k not in ['active_provider', 'last_updated']]),
                'active_provider': settings.get('active_provider'),
                'providers': []
            }
            
            for provider in ['openai', 'groq']:
                if provider in settings:
                    provider_info = {
                        'name': provider,
                        'has_encrypted_key': 'encrypted_api_key' in settings[provider],
                        'last_updated': settings[provider].get('last_updated'),
                        'can_decrypt': False
                    }
                    
                    # Test if we can decrypt the key
                    try:
                        api_key = self.get_api_key(provider)
                        provider_info['can_decrypt'] = api_key is not None
                        provider_info['key_preview'] = api_key[:10] + '...' if api_key else None
                    except:
                        provider_info['can_decrypt'] = False
                    
                    debug_info['providers'].append(provider_info)
            
            return debug_info
            
        except Exception as e:
            return {
                'error': f'Failed to get debug info: {str(e)}'
            }


# Global service instance
_ai_settings_service = None

def get_ai_settings_service() -> AISettingsService:
    """Get or create the global AI settings service instance"""
    global _ai_settings_service
    if _ai_settings_service is None:
        _ai_settings_service = AISettingsService()
    return _ai_settings_service
