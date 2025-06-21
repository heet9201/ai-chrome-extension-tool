"""
Cryptographic utilities for secure API key storage
Provides AES-256 encryption for sensitive data
"""

import os
import base64
import hashlib
from pathlib import Path
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from .env_manager import getenv, get_env_manager


class SecureCrypto:
    """Handles encryption and decryption of sensitive data"""
    
    def __init__(self, master_password: str = None):
        """
        Initialize crypto with a master password
        If no master password provided, uses environment variable or generates one
        """
        if master_password is None:
            master_password = getenv('CRYPTO_MASTER_KEY')
            if master_password is None:
                # Generate a secure master key
                master_password = base64.urlsafe_b64encode(os.urandom(32)).decode()
                
                # Save to runtime environment
                os.environ['CRYPTO_MASTER_KEY'] = master_password
                
                # Save to .env file for persistence
                self._save_crypto_key_to_env_file(master_password)
                
                print("Generated new master key and saved to .env file for persistence.")
            else: 
                print("Using existing master key from environment variable.")
        
        self.master_password = master_password.encode()
        self.salt = b'linkedin_job_assistant_salt'  # In production, use random salt per installation
        
    def _save_crypto_key_to_env_file(self, crypto_key: str):
        """Save the generated crypto key to .env file"""
        try:
            # Get the .env file path from the environment manager
            env_manager = get_env_manager()
            env_file_path = env_manager.get_env_file_path()
            
            if env_file_path and env_file_path.exists():
                # Read current content
                with open(env_file_path, 'r') as f:
                    content = f.read()
                
                # Check if CRYPTO_MASTER_KEY already exists
                if 'CRYPTO_MASTER_KEY' not in content:
                    # Add the crypto key to the end of the file
                    if not content.endswith('\n'):
                        content += '\n'
                    
                    content += f'\n# Cryptographic Master Key (Auto-generated)\n'
                    content += f'CRYPTO_MASTER_KEY={crypto_key}\n'
                    
                    # Write back to file
                    with open(env_file_path, 'w') as f:
                        f.write(content)
                    
                    print(f"✅ CRYPTO_MASTER_KEY saved to {env_file_path}")
                else:
                    print("ℹ️  CRYPTO_MASTER_KEY already exists in .env file")
            else:
                print("⚠️  Could not find .env file to save CRYPTO_MASTER_KEY")
                
        except Exception as e:
            print(f"❌ Error saving CRYPTO_MASTER_KEY to .env file: {str(e)}")
            print("🔧 Please manually add the following line to your .env file:")
            print(f"CRYPTO_MASTER_KEY={crypto_key}")
        
    def _get_fernet_key(self) -> Fernet:
        """Generate Fernet key from master password"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.master_password))
        return Fernet(key)
    
    def encrypt(self, data: str) -> str:
        """Encrypt a string and return base64 encoded result"""
        if not data:
            return ""
        
        fernet = self._get_fernet_key()
        encrypted_data = fernet.encrypt(data.encode())
        return base64.urlsafe_b64encode(encrypted_data).decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt base64 encoded encrypted string"""
        if not encrypted_data:
            return ""
        
        try:
            fernet = self._get_fernet_key()
            decoded_data = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted_data = fernet.decrypt(decoded_data)
            return decrypted_data.decode()
        except Exception as e:
            raise ValueError(f"Failed to decrypt data: {str(e)}")
    
    def hash_data(self, data: str) -> str:
        """Create a secure hash of data for verification"""
        return hashlib.sha256(data.encode()).hexdigest()


# Global crypto instance
_crypto_instance = None

def get_crypto_instance() -> SecureCrypto:
    """Get or create the global crypto instance"""
    global _crypto_instance
    if _crypto_instance is None:
        _crypto_instance = SecureCrypto()
    return _crypto_instance


def encrypt_api_key(api_key: str) -> str:
    """Convenience function to encrypt an API key"""
    crypto = get_crypto_instance()
    return crypto.encrypt(api_key)


def decrypt_api_key(encrypted_key: str) -> str:
    """Convenience function to decrypt an API key"""
    crypto = get_crypto_instance()
    return crypto.decrypt(encrypted_key)


def validate_api_key_format(provider: str, api_key: str) -> bool:
    """Validate API key format for different providers"""
    if not api_key:
        return False
    
    if provider == 'openai':
        # OpenAI keys start with 'sk-' and are typically 51+ characters
        return api_key.startswith('sk-') and len(api_key) >= 40
    elif provider == 'groq':
        # Groq keys start with 'gsk_' and are typically 56+ characters
        return api_key.startswith('gsk_') and len(api_key) >= 40
    
    return False
