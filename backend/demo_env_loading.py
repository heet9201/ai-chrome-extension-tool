#!/usr/bin/env python3
"""
Example script demonstrating the environment loading pattern
Shows how to use the centralized environment manager throughout the project
"""

# Import the environment utilities
from utils.env_manager import getenv, getenv_bool, getenv_int, get_env_manager

def main():
    """Demonstrate environment variable loading with .env support"""
    
    print("🔧 Environment Configuration Demo")
    print("=" * 40)
    
    # Get the environment manager instance
    env_manager = get_env_manager()
    
    # Show which .env file was loaded (if any)
    env_file_path = env_manager.get_env_file_path()
    if env_file_path:
        print(f"📁 Loaded .env file from: {env_file_path}")
    else:
        print("📁 No .env file found, using system environment variables")
    
    print(f"✅ Environment loading status: {'Success' if env_manager.is_loaded() else 'Failed'}")
    print()
    
    # Demonstrate different types of environment variable loading
    print("🔧 Environment Variables:")
    print("-" * 25)
    
    # String variables
    debug_str = getenv("DEBUG", "False")
    ai_provider = getenv("AI_PROVIDER", "openai")
    email_address = getenv("EMAIL_ADDRESS", "not-configured")
    
    # Boolean variables (using the helper function)
    debug = getenv_bool("DEBUG", False)
    
    # Integer variables (using the helper function)
    port = getenv_int("PORT", 5000)
    smtp_port = getenv_int("SMTP_PORT", 587)
    
    # Display the loaded values
    print(f"DEBUG (string): '{debug_str}' -> (boolean): {debug}")
    print(f"PORT: {port} (type: {type(port).__name__})")
    print(f"AI_PROVIDER: '{ai_provider}'")
    print(f"EMAIL_ADDRESS: '{email_address}'")
    print(f"SMTP_PORT: {smtp_port} (type: {type(smtp_port).__name__})")
    
    # Show OpenAI API key (masked for security)
    openai_key = getenv("OPENAI_API_KEY", "not-configured")
    if openai_key != "not-configured":
        # Mask the API key for display
        masked_key = openai_key[:6] + "..." + openai_key[-4:] if len(openai_key) > 10 else "configured"
        print(f"OPENAI_API_KEY: {masked_key}")
    else:
        print(f"OPENAI_API_KEY: {openai_key}")
    
    print()
    print("✨ Environment loading completed successfully!")
    
    # Test crypto functionality
    print()
    print("� Testing Crypto Functionality:")
    print("-" * 30)
    
    try:
        from utils.crypto import encrypt_api_key, decrypt_api_key, get_crypto_instance
        
        # Test with a sample API key
        sample_key = "sk-test1234567890abcdefghijklmnopqrstuvwxyz"
        encrypted = encrypt_api_key(sample_key)
        decrypted = decrypt_api_key(encrypted)
        
        print(f"Sample API Key: {sample_key[:15]}...")
        print(f"Encrypted: {encrypted[:25]}...")
        print(f"Decryption Success: {sample_key == decrypted}")
        
        # Check if crypto key is persistent
        crypto_key = getenv("CRYPTO_MASTER_KEY")
        if crypto_key:
            print(f"Persistent Crypto Key: {crypto_key[:15]}... (✅ Saved in .env)")
        else:
            print("Persistent Crypto Key: Not found (❌ Not saved)")
            
    except Exception as e:
        print(f"❌ Crypto test failed: {str(e)}")
    
    print()
    print("�💡 Usage Examples:")
    print("   from utils.env_manager import getenv, getenv_bool, getenv_int")
    print("   debug = getenv_bool('DEBUG', False)")
    print("   port = getenv_int('PORT', 5000)")
    print("   api_key = getenv('OPENAI_API_KEY')")
    print("   from utils.crypto import encrypt_api_key, decrypt_api_key")
    print("   encrypted = encrypt_api_key('your-secret-key')")

if __name__ == "__main__":
    main()
