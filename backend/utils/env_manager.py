"""
Environment Manager for AI Chrome Extension Tool
Centralized environment variable loading with .env support
"""

import os
from pathlib import Path
from typing import Union, Optional

# Import dotenv if available
try:
    from dotenv import load_dotenv
    DOTENV_AVAILABLE = True
except ImportError:
    DOTENV_AVAILABLE = False
    print("Warning: python-dotenv not available. Environment variables will be loaded from system only.")


class EnvManager:
    """Centralized environment variable manager with .env file support"""
    
    def __init__(self, env_file: Optional[Union[str, Path]] = None):
        """
        Initialize environment manager
        
        Args:
            env_file: Path to .env file. If None, searches for .env in current and parent directories
        """
        self._loaded = False
        self.env_file_path = None
        
        if env_file:
            self.env_file_path = Path(env_file)
        else:
            # Search for .env file in current directory and parent directories
            self.env_file_path = self._find_env_file()
        
        self._load_environment()
    
    def _find_env_file(self) -> Optional[Path]:
        """Find .env file in current directory or parent directories"""
        current_dir = Path.cwd()
        
        # Check current directory first
        env_path = current_dir / '.env'
        if env_path.exists():
            return env_path
        
        # Check parent directories (useful when running from subdirectories)
        for parent in current_dir.parents:
            env_path = parent / '.env'
            if env_path.exists():
                return env_path
        
        # Check the directory where this script is located (backend directory)
        script_dir = Path(__file__).parent.parent
        env_path = script_dir / '.env'
        if env_path.exists():
            return env_path
        
        return None
    
    def _load_environment(self):
        """Load environment variables from .env file if available"""
        if not DOTENV_AVAILABLE:
            print("Info: Using system environment variables only (dotenv not available)")
            self._loaded = True
            return
        
        if self.env_file_path and self.env_file_path.exists():
            try:
                load_dotenv(dotenv_path=self.env_file_path)
                print(f"Info: Loaded environment variables from {self.env_file_path}")
                self._loaded = True
            except Exception as e:
                print(f"Warning: Failed to load .env file from {self.env_file_path}: {e}")
                self._loaded = False
        else:
            print("Info: No .env file found, using system environment variables only")
            self._loaded = True
    
    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """
        Get environment variable value
        
        Args:
            key: Environment variable name
            default: Default value if variable is not found
            
        Returns:
            Environment variable value or default
        """
        return os.getenv(key, default)
    
    def get_bool(self, key: str, default: bool = False) -> bool:
        """
        Get environment variable as boolean
        
        Args:
            key: Environment variable name
            default: Default boolean value
            
        Returns:
            Boolean value of environment variable
        """
        value = self.get(key, str(default)).lower()
        return value in ('true', '1', 'yes', 'on')
    
    def get_int(self, key: str, default: int = 0) -> int:
        """
        Get environment variable as integer
        
        Args:
            key: Environment variable name
            default: Default integer value
            
        Returns:
            Integer value of environment variable
        """
        try:
            return int(self.get(key, str(default)))
        except (ValueError, TypeError):
            return default
    
    def get_float(self, key: str, default: float = 0.0) -> float:
        """
        Get environment variable as float
        
        Args:
            key: Environment variable name
            default: Default float value
            
        Returns:
            Float value of environment variable
        """
        try:
            return float(self.get(key, str(default)))
        except (ValueError, TypeError):
            return default
    
    def require(self, key: str) -> str:
        """
        Get required environment variable, raise error if not found
        
        Args:
            key: Environment variable name
            
        Returns:
            Environment variable value
            
        Raises:
            ValueError: If environment variable is not found
        """
        value = self.get(key)
        if value is None:
            raise ValueError(f"Required environment variable '{key}' not found")
        return value
    
    def set(self, key: str, value: str):
        """
        Set environment variable
        
        Args:
            key: Environment variable name
            value: Environment variable value
        """
        os.environ[key] = str(value)
    
    def is_loaded(self) -> bool:
        """Check if environment was loaded successfully"""
        return self._loaded
    
    def get_env_file_path(self) -> Optional[Path]:
        """Get path to loaded .env file"""
        return self.env_file_path


# Global environment manager instance
_env_manager = None

def get_env_manager() -> EnvManager:
    """Get or create the global environment manager instance"""
    global _env_manager
    if _env_manager is None:
        _env_manager = EnvManager()
    return _env_manager

def getenv(key: str, default: Optional[str] = None) -> Optional[str]:
    """
    Convenience function to get environment variable with .env support
    
    Args:
        key: Environment variable name
        default: Default value if variable is not found
        
    Returns:
        Environment variable value or default
    """
    env_manager = get_env_manager()
    return env_manager.get(key, default)

def getenv_bool(key: str, default: bool = False) -> bool:
    """
    Convenience function to get environment variable as boolean
    
    Args:
        key: Environment variable name
        default: Default boolean value
        
    Returns:
        Boolean value of environment variable
    """
    env_manager = get_env_manager()
    return env_manager.get_bool(key, default)

def getenv_int(key: str, default: int = 0) -> int:
    """
    Convenience function to get environment variable as integer
    
    Args:
        key: Environment variable name
        default: Default integer value
        
    Returns:
        Integer value of environment variable
    """
    env_manager = get_env_manager()
    return env_manager.get_int(key, default)

def getenv_float(key: str, default: float = 0.0) -> float:
    """
    Convenience function to get environment variable as float
    
    Args:
        key: Environment variable name
        default: Default float value
        
    Returns:
        Float value of environment variable
    """
    env_manager = get_env_manager()
    return env_manager.get_float(key, default)

def require_env(key: str) -> str:
    """
    Convenience function to get required environment variable
    
    Args:
        key: Environment variable name
        
    Returns:
        Environment variable value
        
    Raises:
        ValueError: If environment variable is not found
    """
    env_manager = get_env_manager()
    return env_manager.require(key)

# Initialize the global environment manager when module is imported
get_env_manager()
