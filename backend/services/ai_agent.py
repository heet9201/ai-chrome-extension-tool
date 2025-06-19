"""
AI Agent Service for LinkedIn Job Analysis
Analyzes job posts and generates personalized application emails
"""

import os
import json
import re
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

@dataclass
class UserProfile:
    """User profile data structure"""
    name: str
    experience: int
    domain: str
    skills: list
    preferred_roles: list
    preferred_work_type: list
    excluded_roles: list
    preferred_company_types: list
    email: str
    phone: str = ""
    resume_url: str = ""

@dataclass
class JobData:
    """Job data structure"""
    type: str  # 'job_page' or 'feed_post'
    title: str = ""
    company: str = ""
    location: str = ""
    description: str = ""
    content: str = ""
    contact_info: dict = None
    url: str = ""
    timestamp: str = ""

class JobAnalysisAgent:
    """AI Agent for analyzing job posts and generating application emails"""
    
    def __init__(self):
        self.openai_client = None
        self.setup_ai_client()
        
    def setup_ai_client(self):
        """Setup OpenAI client if API key is available"""
        api_key = os.getenv('OPENAI_API_KEY')
        if api_key and OPENAI_AVAILABLE:
            openai.api_key = api_key
            self.openai_client = openai
        else:
            print("Warning: OpenAI not available. Using fallback analysis.")
    
    def analyze_job(self, job_data: dict, user_profile: dict) -> dict:
        """
        Main method to analyze a job post
        
        Args:
            job_data: Dictionary containing job post information
            user_profile: Dictionary containing user profile information
            
        Returns:
            Dictionary containing analysis results
        """
        try:
            # Convert dictionaries to dataclasses
            job = self._parse_job_data(job_data)
            profile = self._parse_user_profile(user_profile)
            
            # Use AI if available, otherwise use rule-based analysis
            if self.openai_client:
                return self._ai_analysis(job, profile)
            else:
                return self._rule_based_analysis(job, profile)
                
        except Exception as e:
            print(f"Error in job analysis: {str(e)}")
            return self._error_response(str(e))
    
    def _parse_job_data(self, data: dict) -> JobData:
        """Parse job data dictionary into JobData object"""
        contact_info = data.get('contactInfo', {})
        if isinstance(contact_info, dict):
            contact_info = contact_info
        else:
            contact_info = {}
            
        return JobData(
            type=data.get('type', ''),
            title=data.get('title', ''),
            company=data.get('company', ''),
            location=data.get('location', ''),
            description=data.get('description', ''),
            content=data.get('content', ''),
            contact_info=contact_info,
            url=data.get('url', ''),
            timestamp=data.get('timestamp', '')
        )
    
    def _parse_user_profile(self, data: dict) -> UserProfile:
        """Parse user profile dictionary into UserProfile object"""
        return UserProfile(
            name=data.get('name', 'Heet Dedakiya'),
            experience=data.get('experience', 1),
            domain=data.get('domain', 'Python Backend Development + AI/ML'),
            skills=data.get('skills', ['Python', 'Flask', 'FastAPI', 'TensorFlow']),
            preferred_roles=data.get('preferredRoles', ['Backend Developer', 'AI/ML Engineer']),
            preferred_work_type=data.get('preferredWorkType', ['Remote', 'Hybrid']),
            excluded_roles=data.get('excludedRoles', ['Frontend', 'Sales']),
            preferred_company_types=data.get('preferredCompanyTypes', ['Tech startups']),
            email=data.get('email', 'heet.dedakiya@example.com'),
            phone=data.get('phone', '+91-XXXXXXXXXX'),
            resume_url=data.get('resumeUrl', '')
        )
    
    def _ai_analysis(self, job: JobData, profile: UserProfile) -> dict:
        """AI-powered job analysis using OpenAI"""
        try:
            # Prepare job content for analysis
            job_content = self._extract_job_content(job)
            
            # Create prompt for AI analysis
            prompt = self._create_analysis_prompt(job_content, profile)
            
            # Call OpenAI API
            response = self.openai_client.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a smart AI agent that helps automate job applications. Analyze job posts and return JSON responses as specified."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=1000,
                temperature=0.7
            )
            
            # Parse AI response
            ai_response = response.choices[0].message.content.strip()
            
            # Try to extract JSON from response
            try:
                # Look for JSON in the response
                json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                    return self._validate_and_enhance_result(result, job, profile)
                else:
                    raise ValueError("No JSON found in AI response")
            except json.JSONDecodeError:
                # Fallback to rule-based if JSON parsing fails
                print("Failed to parse AI response as JSON, falling back to rule-based analysis")
                return self._rule_based_analysis(job, profile)
                
        except Exception as e:
            print(f"AI analysis failed: {str(e)}")
            return self._rule_based_analysis(job, profile)
    
    def _rule_based_analysis(self, job: JobData, profile: UserProfile) -> dict:
        """Rule-based job analysis as fallback"""
        
        # Extract all text content
        job_content = self._extract_job_content(job).lower()
        
        # Check relevance based on keywords
        relevance_result = self._check_relevance(job_content, profile)
        
        if not relevance_result['is_relevant']:
            return {
                "status": "NOT RELEVANT",
                "reason": relevance_result['reason'],
                "contact": None,
                "email_subject": "",
                "email_body": "",
                "attachment_required": False
            }
        
        # Extract contact information
        contact_email = self._extract_contact_email(job)
        
        # Generate email
        email_data = self._generate_email(job, profile, contact_email)
        
        return {
            "status": "RELEVANT",
            "reason": relevance_result['reason'],
            "contact": contact_email,
            "email_subject": email_data['subject'],
            "email_body": email_data['body'],
            "attachment_required": True
        }
    
    def _extract_job_content(self, job: JobData) -> str:
        """Extract all relevant text from job data"""
        content_parts = []
        
        if job.title:
            content_parts.append(f"Title: {job.title}")
        if job.company:
            content_parts.append(f"Company: {job.company}")
        if job.location:
            content_parts.append(f"Location: {job.location}")
        if job.description:
            content_parts.append(f"Description: {job.description}")
        if job.content:
            content_parts.append(f"Content: {job.content}")
            
        return "\n".join(content_parts)
    
    def _check_relevance(self, job_content: str, profile: UserProfile) -> dict:
        """Check if job is relevant based on user profile"""
        
        # Keywords that indicate relevance
        relevant_keywords = [
            'python', 'flask', 'fastapi', 'django', 'backend', 'api',
            'machine learning', 'ml', 'ai', 'artificial intelligence',
            'tensorflow', 'pytorch', 'scikit', 'pandas', 'numpy',
            'data science', 'nlp', 'computer vision', 'deep learning'
        ]
        
        # Keywords that indicate non-relevance
        excluded_keywords = [
            'frontend', 'react', 'angular', 'vue', 'javascript only',
            'sales', 'marketing', 'business development', 'hr',
            'devops only', '.net only', 'php only', 'java only',
            'android only', 'ios only', 'mobile only'
        ]
        
        # Additional skills from profile
        profile_skills = [skill.lower() for skill in profile.skills]
        relevant_keywords.extend(profile_skills)
        
        # Check for relevant keywords
        relevant_count = sum(1 for keyword in relevant_keywords if keyword in job_content)
        excluded_count = sum(1 for keyword in excluded_keywords if keyword in job_content)
        
        # Check preferred roles
        role_match = any(role.lower() in job_content for role in profile.preferred_roles)
        
        # Check excluded roles
        excluded_role_match = any(role.lower() in job_content for role in profile.excluded_roles)
        
        if excluded_count > 0 or excluded_role_match:
            return {
                'is_relevant': False,
                'reason': 'Job contains excluded technologies or roles that don\'t match your profile'
            }
        
        if relevant_count >= 2 or role_match:
            return {
                'is_relevant': True,
                'reason': f'Job matches your {profile.domain} profile with relevant technologies and skills'
            }
        
        return {
            'is_relevant': False,
            'reason': 'Job doesn\'t contain enough relevant keywords or technologies for your profile'
        }
    
    def _extract_contact_email(self, job: JobData) -> Optional[str]:
        """Extract contact email from job data"""
        
        # Check contact info from job data
        if job.contact_info and 'emails' in job.contact_info:
            emails = job.contact_info['emails']
            if emails and len(emails) > 0:
                return emails[0]
        
        # Look for email patterns in text content
        all_text = self._extract_job_content(job)
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, all_text)
        
        if emails:
            return emails[0]
        
        return None
    
    def _generate_email(self, job: JobData, profile: UserProfile, contact_email: Optional[str]) -> dict:
        """Generate personalized application email"""
        
        # Determine job title for email
        job_title = job.title or "the position"
        company_name = job.company or "your company"
        
        # Create email subject
        subject = f"Application for {job_title} - {profile.name}"
        
        # Create email body
        body = f"""Dear Hiring Team,

I hope this email finds you well. I came across your job posting for {job_title} at {company_name} and I'm excited to apply for this opportunity.

As a {profile.domain} professional with {profile.experience} year of industry experience, I believe I would be a valuable addition to your team. My technical expertise includes:

• Backend development using {', '.join(profile.skills[:3])}
• {profile.domain.split(' + ')[1] if ' + ' in profile.domain else 'Full-stack development'}
• Building scalable systems and APIs

What particularly interests me about this role is the opportunity to work with cutting-edge technologies and contribute to innovative projects. I'm passionate about creating efficient, maintainable code and staying up-to-date with the latest industry trends.

I would love to discuss how my skills and experience align with your team's needs. Please find my resume attached for your review.

Thank you for considering my application. I look forward to hearing from you.

Best regards,
{profile.name}
{profile.email}
{profile.phone}"""

        return {
            'subject': subject,
            'body': body
        }
    
    def _create_analysis_prompt(self, job_content: str, profile: UserProfile) -> str:
        """Create prompt for AI analysis"""
        
        return f"""
You are a smart and structured AI agent that helps automate job applications for a developer named {profile.name}.

{profile.name} is a {profile.domain} professional with {profile.experience} year of industry experience. Your task is to analyze the following job post content and help automate the application workflow.

USER PROFILE:
- Name: {profile.name}
- Experience: {profile.experience} year
- Domain: {profile.domain}
- Skills: {', '.join(profile.skills)}
- Preferred Roles: {', '.join(profile.preferred_roles)}
- Preferred Work Type: {', '.join(profile.preferred_work_type)}
- Excluded Roles: {', '.join(profile.excluded_roles)}
- Preferred Company Types: {', '.join(profile.preferred_company_types)}

JOB POST CONTENT:
{job_content}

INSTRUCTIONS:
1. Analyze if this job is relevant to the user's profile
2. Extract contact information if available
3. Generate a personalized application email if relevant
4. Return response in the following JSON format:

{{
  "status": "RELEVANT" or "NOT RELEVANT",
  "reason": "1-2 line explanation of your decision",
  "contact": "email@company.com or null",
  "email_subject": "Email subject line",
  "email_body": "Professional email body with personalized content",
  "attachment_required": true
}}

Keep the email professional, concise, and personalized. Don't exaggerate skills or experience.
"""
    
    def _validate_and_enhance_result(self, result: dict, job: JobData, profile: UserProfile) -> dict:
        """Validate and enhance AI-generated result"""
        
        # Ensure required fields exist
        required_fields = ['status', 'reason', 'contact', 'email_subject', 'email_body', 'attachment_required']
        for field in required_fields:
            if field not in result:
                result[field] = ""
        
        # Validate status
        if result['status'] not in ['RELEVANT', 'NOT RELEVANT']:
            result['status'] = 'NOT RELEVANT'
        
        # Set attachment_required for relevant jobs
        if result['status'] == 'RELEVANT':
            result['attachment_required'] = True
        
        return result
    
    def _error_response(self, error_message: str) -> dict:
        """Return error response"""
        return {
            "status": "ERROR",
            "reason": f"Analysis failed: {error_message}",
            "contact": None,
            "email_subject": "",
            "email_body": "",
            "attachment_required": False
        }

# Convenience function for external use
def analyze_job_post(job_data: dict, user_profile: dict) -> dict:
    """
    Convenience function to analyze a job post
    
    Args:
        job_data: Dictionary containing job post information
        user_profile: Dictionary containing user profile information
        
    Returns:
        Dictionary containing analysis results
    """
    agent = JobAnalysisAgent()
    return agent.analyze_job(job_data, user_profile)