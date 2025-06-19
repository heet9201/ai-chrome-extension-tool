"""
Flask Backend API for LinkedIn Job Assistant Chrome Extension
Handles job analysis, email generation, and email sending
"""

import os
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
from typing import Dict, Any, Optional

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Import our AI agent
from services.ai_agent import analyze_job_post

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for Chrome extension

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

class EmailService:
    """Service for sending emails"""
    
    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.email = os.getenv('EMAIL_ADDRESS')
        self.password = os.getenv('EMAIL_PASSWORD')
        
    def send_email(self, to_email: str, subject: str, body: str, attachment_path: Optional[str] = None) -> Dict[str, Any]:
        """Send email with optional attachment"""
        
        if not self.email or not self.password:
            return {
                'success': False, 
                'error': 'Email credentials not configured. Please set EMAIL_ADDRESS and EMAIL_PASSWORD in .env file'
            }
        
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.email
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Add body to email
            msg.attach(MIMEText(body, 'plain'))
            
            # Add attachment if provided
            if attachment_path and os.path.exists(attachment_path):
                with open(attachment_path, "rb") as attachment:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(attachment.read())
                
                encoders.encode_base64(part)
                part.add_header(
                    'Content-Disposition',
                    f'attachment; filename= {os.path.basename(attachment_path)}'
                )
                msg.attach(part)
            
            # Connect to server and send email
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.email, self.password)
            text = msg.as_string()
            server.sendmail(self.email, to_email, text)
            server.quit()
            
            return {
                'success': True,
                'message': f'Email sent successfully to {to_email}'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to send email: {str(e)}'
            }

# Initialize services
email_service = EmailService()

@app.route('/')
def home():
    """Health check endpoint"""
    return jsonify({
        'status': 'running',
        'service': 'LinkedIn Job Assistant API',
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/analyze-job', methods=['POST'])
def analyze_job():
    """Analyze job post for relevance and generate application email"""
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        job_data = data.get('job_data', {})
        user_profile = data.get('user_profile', {})
        
        if not job_data:
            return jsonify({'error': 'Job data is required'}), 400
        
        # Analyze job using AI agent
        result = analyze_job_post(job_data, user_profile)
        
        # Log analysis for debugging
        app.logger.info(f"Job analysis completed: {result['status']} for job: {job_data.get('title', 'Unknown')}")
        
        return jsonify(result)
        
    except Exception as e:
        app.logger.error(f"Error in job analysis: {str(e)}")
        return jsonify({
            'error': 'Internal server error during job analysis',
            'details': str(e) if app.debug else None
        }), 500

@app.route('/api/send-email', methods=['POST'])
def send_email():
    """Send application email"""
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        to_email = data.get('email')
        subject = data.get('subject')
        body = data.get('body')
        
        if not all([to_email, subject, body]):
            return jsonify({'error': 'Email, subject, and body are required'}), 400
        
        # Check for resume attachment
        attachment_path = None
        if 'resume_path' in data and data['resume_path']:
            attachment_path = data['resume_path']
            if not os.path.exists(attachment_path):
                return jsonify({'error': 'Resume file not found'}), 400
        
        # Send email
        result = email_service.send_email(to_email, subject, body, attachment_path)
        
        if result['success']:
            app.logger.info(f"Email sent successfully to {to_email}")
            return jsonify(result)
        else:
            app.logger.error(f"Failed to send email: {result['error']}")
            return jsonify(result), 500
            
    except Exception as e:
        app.logger.error(f"Error sending email: {str(e)}")
        return jsonify({
            'error': 'Internal server error while sending email',
            'details': str(e) if app.debug else None
        }), 500

@app.route('/api/upload-resume', methods=['POST'])
def upload_resume():
    """Upload resume file"""
    
    try:
        if 'resume' not in request.files:
            return jsonify({'error': 'No resume file provided'}), 400
        
        file = request.files['resume']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Check file type
        allowed_extensions = {'pdf', 'doc', 'docx', 'txt'}
        file_extension = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        
        if file_extension not in allowed_extensions:
            return jsonify({'error': 'Invalid file type. Allowed: PDF, DOC, DOCX, TXT'}), 400
        
        # Save file
        filename = f"resume_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{file_extension}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        app.logger.info(f"Resume uploaded: {filename}")
        
        return jsonify({
            'success': True,
            'filename': filename,
            'path': file_path,
            'message': 'Resume uploaded successfully'
        })
        
    except Exception as e:
        app.logger.error(f"Error uploading resume: {str(e)}")
        return jsonify({
            'error': 'Failed to upload resume',
            'details': str(e) if app.debug else None
        }), 500

@app.route('/api/user-profile', methods=['GET', 'POST'])
def user_profile():
    """Get or update user profile"""
    
    if request.method == 'GET':
        # Return default profile (in production, this would be from database)
        default_profile = {
            'name': 'Heet Dedakiya',
            'experience': 1,
            'domain': 'Python Backend Development + AI/ML',
            'skills': ['Python', 'Flask', 'FastAPI', 'TensorFlow', 'HuggingFace', 'OpenAI API', 'Pandas', 'NumPy'],
            'preferredRoles': ['Backend Developer', 'AI/ML Engineer'],
            'preferredWorkType': ['Remote', 'Hybrid', 'On-site in Ahmedabad, Pune, Bengaluru'],
            'excludedRoles': ['Frontend', 'Sales', 'DevOps', '.NET', 'PHP-only', 'Android-only'],
            'preferredCompanyTypes': ['Tech startups', 'AI-focused firms', 'product-based companies'],
            'email': 'heet.dedakiya@example.com',
            'phone': '+91-XXXXXXXXXX',
            'resumeUrl': ''
        }
        return jsonify(default_profile)
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({'error': 'No profile data provided'}), 400
            
            # In production, save to database
            # For now, just validate and return success
            required_fields = ['name', 'experience', 'domain', 'skills', 'email']
            for field in required_fields:
                if field not in data:
                    return jsonify({'error': f'Required field missing: {field}'}), 400
            
            app.logger.info(f"Profile updated for user: {data.get('name')}")
            
            return jsonify({
                'success': True,
                'message': 'Profile updated successfully'
            })
            
        except Exception as e:
            app.logger.error(f"Error updating profile: {str(e)}")
            return jsonify({
                'error': 'Failed to update profile',
                'details': str(e) if app.debug else None
            }), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get user statistics"""
    
    # In production, this would come from database
    return jsonify({
        'analyzed': 0,
        'relevant': 0,
        'applied': 0,
        'success_rate': 0.0
    })

@app.route('/api/test-email', methods=['POST'])
def test_email():
    """Test email configuration"""
    
    try:
        data = request.get_json()
        test_email = data.get('email', os.getenv('EMAIL_ADDRESS'))
        
        if not test_email:
            return jsonify({'error': 'Test email address required'}), 400
        
        result = email_service.send_email(
            test_email,
            'LinkedIn Job Assistant - Test Email',
            'This is a test email from your LinkedIn Job Assistant. If you received this, your email configuration is working correctly!',
            None
        )
        
        return jsonify(result)
        
    except Exception as e:
        app.logger.error(f"Error in test email: {str(e)}")
        return jsonify({
            'error': 'Failed to send test email',
            'details': str(e) if app.debug else None
        }), 500

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Set up logging
    if not app.debug:
        import logging
        from logging.handlers import RotatingFileHandler
        
        file_handler = RotatingFileHandler('logs/app.log', maxBytes=10240, backupCount=10)
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)
        app.logger.info('LinkedIn Job Assistant API startup')
    
    # Create logs directory
    os.makedirs('logs', exist_ok=True)
    
    # Run the app
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    print(f"🚀 LinkedIn Job Assistant API starting on port {port}")
    print(f"🔗 Available endpoints:")
    print(f"   - POST /api/analyze-job - Analyze job posts")
    print(f"   - POST /api/send-email - Send application emails")
    print(f"   - POST /api/upload-resume - Upload resume files")
    print(f"   - GET/POST /api/user-profile - Manage user profile")
    print(f"   - POST /api/test-email - Test email configuration")
    
    app.run(host='0.0.0.0', port=port, debug=debug)