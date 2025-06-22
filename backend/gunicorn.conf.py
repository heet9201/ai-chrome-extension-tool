# Gunicorn configuration file for LinkedIn Job Assistant
# gunicorn.conf.py

import os
from utils.env_manager import getenv_int, getenv

# Server socket
bind = f"0.0.0.0:{getenv_int('PORT', 5000)}"
backlog = 2048

# Worker processes
workers = getenv_int('GUNICORN_WORKERS', 2)
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2

# Restart workers after this many requests, to help prevent memory leaks
max_requests = 1000
max_requests_jitter = 50

# Logging
accesslog = getenv('GUNICORN_ACCESS_LOG', 'logs/access.log')
errorlog = getenv('GUNICORN_ERROR_LOG', 'logs/error.log')
loglevel = getenv('GUNICORN_LOG_LEVEL', 'info')
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process naming
proc_name = 'linkedin_job_assistant'

# Daemonize the Gunicorn process (detach & enter background)
daemon = False

# The application module and variable name
wsgi_module = "app:app"

# Preload app for better performance
preload_app = True

# Graceful timeout
graceful_timeout = 30

# Enable auto-restart of workers
reload = getenv('GUNICORN_RELOAD', 'False').lower() == 'true'

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190
