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

# Import environment utilities
from utils.env_manager import getenv

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

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
    
    def __init__(self, provider: str = None, api_key: str = None, **kwargs):
        self.provider = provider or getenv('AI_PROVIDER', 'openai')
        self.api_key = api_key
        self.temperature = kwargs.get('temperature', 0.7)
        self.max_tokens = kwargs.get('max_tokens', 1500)
        self.enable_optimizations = kwargs.get('enable_optimizations', True)
        
        self.ai_client = None
        if api_key:
            self.setup_ai_client()
        
    def setup_ai_client(self):
        """Setup AI client based on provider"""
        try:
            if self.provider == 'openai' and OPENAI_AVAILABLE:
                from openai import OpenAI
                self.ai_client = OpenAI(api_key=self.api_key)
            elif self.provider == 'groq' and GROQ_AVAILABLE:
                self.ai_client = Groq(api_key=self.api_key)
            else:
                print(f"Warning: {self.provider} not available or not supported.")
        except Exception as e:
            print(f"Error setting up AI client: {str(e)}")
            self.ai_client = None
    
    def test_connection(self) -> dict:
        """Test the AI connection and return status"""
        if not self.ai_client:
            # Try to setup the client if we have the api_key
            if self.api_key:
                self.setup_ai_client()
            
            if not self.ai_client:
                return {
                    'success': False,
                    'error': f'{self.provider} client not initialized'
                }
        
        try:
            if self.provider == 'openai':
                # Test with a simple completion
                response = self.ai_client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": "Hello"}],
                    max_tokens=5
                )
                return {
                    'success': True,
                    'model': 'gpt-3.5-turbo',
                    'response': response.choices[0].message.content.strip()
                }
            elif self.provider == 'groq':
                # Test with a simple completion
                response = self.ai_client.chat.completions.create(
                    model="llama3-8b-8192",
                    messages=[{"role": "user", "content": "Hello"}],
                    max_tokens=5
                )
                return {
                    'success': True,
                    'model': 'llama3-8b-8192',
                    'response': response.choices[0].message.content.strip()
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
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
            if self.ai_client:
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
        """AI-powered job analysis using configured provider"""
        try:
            # Prepare job content for analysis
            job_content = self._extract_job_content(job)
            
            # Create prompt for AI analysis
            prompt = self._create_analysis_prompt(job_content, profile)
            
            # Call AI API based on provider
            if self.provider == 'openai':
                response = self.ai_client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a smart AI agent that helps automate job applications. You MUST respond with valid JSON only, no additional text or explanations. Follow the exact JSON format specified in the user prompt."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    max_tokens=self.max_tokens,
                    temperature=self.temperature
                )
                ai_response = response.choices[0].message.content.strip()
                
            elif self.provider == 'groq':
                response = self.ai_client.chat.completions.create(
                    model="llama3-8b-8192",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a smart AI agent that helps automate job applications. You MUST respond with valid JSON only, no additional text or explanations. Follow the exact JSON format specified in the user prompt."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    max_tokens=self.max_tokens,
                    temperature=self.temperature
                )
                ai_response = response.choices[0].message.content.strip()
            
            else:
                raise ValueError(f"Unsupported AI provider: {self.provider}")
            
            # Try to extract JSON from response
            try:
                print(f"🤖 AI Response from {self.provider}:")
                print(f"Raw response: {ai_response[:500]}...")  # Show first 500 chars for debugging
                
                # Try multiple JSON extraction methods
                json_result = self._extract_json_from_response(ai_response)
                
                if json_result:
                    print("✅ Successfully extracted JSON from AI response")
                    return self._validate_and_enhance_result(json_result, job, profile)
                else:
                    raise ValueError("No valid JSON found in AI response")
                    
            except json.JSONDecodeError as e:
                print(f"❌ JSON parsing error: {str(e)}")
                print(f"🔄 AI response that failed to parse: {ai_response}")
                print("🔄 Falling back to rule-based analysis")
                return self._rule_based_analysis(job, profile)
            except Exception as e:
                print(f"❌ Error extracting JSON: {str(e)}")
                print("🔄 Falling back to rule-based analysis")
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
4. Return ONLY a valid JSON response in the exact format below (no additional text):

```json
{{
  "status": "RELEVANT" or "NOT RELEVANT",
  "reason": "1-2 line explanation of your decision",
  "contact": "email@company.com or null",
  "email_subject": "Email subject line",
  "email_body": "Professional email body with personalized content",
  "attachment_required": true
}}
```

IMPORTANT: 
- Return ONLY the JSON, no other text
- Use double quotes for all strings
- If no contact email found, use null (not "null")
- Keep email content professional and concise
- Don't include newlines in JSON string values, use \\n instead
"""
    
    def _validate_and_enhance_result(self, result: dict, job: JobData, profile: UserProfile) -> dict:
        """Validate and enhance AI-generated result"""
        
        print(f"🔍 Validating AI result: {result}")
        
        # Ensure required fields exist
        required_fields = ['status', 'reason', 'contact', 'email_subject', 'email_body', 'attachment_required']
        for field in required_fields:
            if field not in result:
                print(f"⚠️ Missing field '{field}', setting to default value")
                if field == 'attachment_required':
                    result[field] = False
                elif field == 'contact':
                    result[field] = None
                else:
                    result[field] = ""
        
        # Validate status
        if result['status'] not in ['RELEVANT', 'NOT RELEVANT']:
            print(f"⚠️ Invalid status '{result['status']}', setting to NOT RELEVANT")
            result['status'] = 'NOT RELEVANT'
        
        # Ensure contact is properly formatted
        if result['contact'] == 'null' or result['contact'] == '':
            result['contact'] = None
        
        # Set attachment_required for relevant jobs
        if result['status'] == 'RELEVANT':
            result['attachment_required'] = True
        
        # Clean up email content (remove any problematic characters)
        if result['email_body']:
            # Replace literal \n with actual newlines
            result['email_body'] = result['email_body'].replace('\\n', '\n')
        
        print(f"✅ Validated result: {result}")
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
    
    def _extract_json_from_response(self, response: str) -> Optional[dict]:
        """Extract JSON from AI response using multiple methods"""
        
        # Method 1: Try direct JSON parsing (if response is pure JSON)
        try:
            return json.loads(response.strip())
        except json.JSONDecodeError:
            pass
        
        # Method 2: Look for JSON code blocks (```json ... ```)
        json_block_pattern = r'```(?:json)?\s*(\{.*?\})\s*```'
        json_match = re.search(json_block_pattern, response, re.DOTALL | re.IGNORECASE)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass
        
        # Method 3: Look for balanced braces (improved version)
        brace_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
        matches = re.findall(brace_pattern, response, re.DOTALL)
        for match in matches:
            try:
                return json.loads(match)
            except json.JSONDecodeError:
                continue
        
        # Method 4: Find the largest JSON-like structure
        start_idx = response.find('{')
        if start_idx != -1:
            brace_count = 0
            for i, char in enumerate(response[start_idx:], start_idx):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        try:
                            json_str = response[start_idx:i+1]
                            return json.loads(json_str)
                        except json.JSONDecodeError:
                            break
        
        # Method 5: Try to fix common JSON issues
        try:
            # Remove any text before the first { and after the last }
            start = response.find('{')
            end = response.rfind('}')
            if start != -1 and end != -1 and end > start:
                json_candidate = response[start:end+1]
                
                # Fix common issues
                json_candidate = json_candidate.replace('\n', '\\n')
                json_candidate = re.sub(r',\s*}', '}', json_candidate)  # Remove trailing commas
                json_candidate = re.sub(r',\s*]', ']', json_candidate)  # Remove trailing commas in arrays
                
                return json.loads(json_candidate)
        except json.JSONDecodeError:
            pass
        
        return None

# Convenience function for external use
def analyze_job_post(job_data: dict, user_profile: dict, ai_settings: dict = None) -> dict:
    """
    Convenience function to analyze a job post
    
    Args:
        job_data: Dictionary containing job post information
        user_profile: Dictionary containing user profile information
        ai_settings: Dictionary containing AI configuration (provider, api_key, etc.)
        
    Returns:
        Dictionary containing analysis results
    """
    if ai_settings:
        agent = JobAnalysisAgent(
            provider=ai_settings.get('provider'),
            api_key=ai_settings.get('api_key'),
            temperature=ai_settings.get('temperature', 0.7),
            max_tokens=ai_settings.get('max_tokens', 1500),
            enable_optimizations=ai_settings.get('enable_optimizations', True)
        )
    else:
        # Fallback to environment variables or default settings
        agent = JobAnalysisAgent()
    
    # Get the basic analysis
    result = agent.analyze_job(job_data, user_profile)
    
    # Add resume skills analysis if resume exists
    resume_url = user_profile.get('resumeUrl', '')
    if resume_url and os.path.exists(resume_url):
        try:
            # Import here to avoid circular imports
            from utils.resume_parser import get_resume_skills_for_job
            
            # Extract job keywords for matching
            job_text = (job_data.get('title', '') + ' ' + 
                       job_data.get('description', '') + ' ' + 
                       job_data.get('content', '')).lower()
            
            # Extract keywords (simple approach - can be enhanced)
            job_keywords = []
            common_tech_words = [
                'python', 'java', 'javascript', 'react', 'angular', 'vue', 'flask', 'django',
                'fastapi', 'node', 'express', 'mongodb', 'postgresql', 'mysql', 'redis',
                'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'git', 'jenkins', 'ci/cd',
                'machine learning', 'ai', 'deep learning', 'tensorflow', 'pytorch',
                'api', 'rest', 'graphql', 'microservices', 'agile', 'scrum'
            ]
            
            for word in common_tech_words:
                if word in job_text:
                    job_keywords.append(word)
            
            # Get matching resume skills
            resume_analysis = get_resume_skills_for_job(resume_url, job_keywords)
            
            if resume_analysis.get('success'):
                relevant_skills = resume_analysis.get('relevant_skills', [])
                
                # Update result with resume information
                result.update({
                    'resume_skills_used': len(relevant_skills) > 0,
                    'resume_skills_count': len(relevant_skills),
                    'relevant_resume_skills': relevant_skills[:10],  # Limit to top 10
                    'total_resume_skills': resume_analysis.get('total_skills', 0),
                    'skills_match_percentage': resume_analysis.get('match_percentage', 0),
                    'has_resume': True
                })
                
                # If we found relevant skills, mention them in the email
                if len(relevant_skills) > 0 and result.get('status') == 'RELEVANT':
                    # Enhance email body with resume skills
                    current_body = result.get('email_body', '')
                    skills_text = ', '.join(relevant_skills[:5])  # Top 5 skills
                    
                    # Add skills mention if not already present
                    if 'resume' not in current_body.lower():
                        enhanced_body = current_body.replace(
                            'I believe I would be a great fit for this role.',
                            f'I believe I would be a great fit for this role. My resume highlights my expertise in {skills_text}, which directly aligns with your requirements.'
                        )
                        
                        if enhanced_body != current_body:
                            result['email_body'] = enhanced_body
            else:
                result.update({
                    'resume_skills_used': False,
                    'resume_skills_count': 0,
                    'relevant_resume_skills': [],
                    'has_resume': True
                })
        except Exception as e:
            print(f"Error analyzing resume skills: {str(e)}")
            result.update({
                'resume_skills_used': False,
                'resume_skills_count': 0,
                'relevant_resume_skills': [],
                'has_resume': True
            })
    else:
        # No resume uploaded
        result.update({
            'resume_skills_used': False,
            'resume_skills_count': 0,
            'relevant_resume_skills': [],
            'has_resume': False
        })
    
    return result