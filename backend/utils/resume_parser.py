"""
Resume Parser Utility
Extracts skills and information from uploaded resume files
Works without spacy dependency by using regex and keyword matching
"""

import os
import re
from typing import Dict, List, Any, Optional
import json
from pathlib import Path

try:
    import PyPDF2
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    import docx
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

class ResumeParser:
    """Parser for extracting skills and information from resumes"""
    
    def __init__(self):
        # Common technical skills database
        self.skills_database = {
            'programming_languages': [
                'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'go', 'rust', 
                'php', 'ruby', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'sql', 'html', 'css'
            ],
            'frameworks': [
                'react', 'angular', 'vue', 'svelte', 'flask', 'django', 'fastapi', 'express',
                'spring', 'laravel', 'rails', 'asp.net', 'tensorflow', 'pytorch', 'keras',
                'scikit-learn', 'pandas', 'numpy', 'matplotlib', 'seaborn', 'opencv'
            ],
            'databases': [
                'mysql', 'postgresql', 'mongodb', 'redis', 'sqlite', 'oracle', 'cassandra',
                'elasticsearch', 'dynamodb', 'firebase', 'neo4j'
            ],
            'cloud_platforms': [
                'aws', 'azure', 'gcp', 'google cloud', 'heroku', 'digitalocean', 'vercel',
                'netlify', 'cloudflare'
            ],
            'tools': [
                'git', 'docker', 'kubernetes', 'jenkins', 'gitlab', 'github', 'jira',
                'confluence', 'slack', 'figma', 'adobe', 'photoshop', 'illustrator'
            ],
            'ai_ml': [
                'machine learning', 'deep learning', 'neural networks', 'nlp', 'computer vision',
                'data science', 'artificial intelligence', 'huggingface', 'openai', 'langchain',
                'transformers', 'bert', 'gpt', 'llm', 'chatbot'
            ],
            'soft_skills': [
                'leadership', 'communication', 'teamwork', 'problem solving', 'analytical',
                'creative', 'adaptable', 'organized', 'detail-oriented', 'time management'
            ]
        }
        
        # Flatten all skills into a single list for matching
        self.all_skills = []
        for category, skills in self.skills_database.items():
            self.all_skills.extend(skills)
    
    def parse_resume(self, file_path: str) -> Dict[str, Any]:
        """
        Parse resume file and extract skills and information
        
        Args:
            file_path: Path to the resume file
            
        Returns:
            Dictionary containing extracted information
        """
        try:
            if not os.path.exists(file_path):
                return {'success': False, 'error': 'File not found'}
            
            # Extract text based on file type
            text = self._extract_text_from_file(file_path)
            
            if not text:
                return {'success': False, 'error': 'Could not extract text from file'}
            
            # Parse information from text
            parsed_data = self._parse_text_content(text)
            
            # Add metadata
            parsed_data.update({
                'success': True,
                'file_path': file_path,
                'file_name': os.path.basename(file_path),
                'file_size': os.path.getsize(file_path),
                'parsed_at': str(Path(file_path).stat().st_mtime)
            })
            
            return parsed_data
            
        except Exception as e:
            return {'success': False, 'error': f'Error parsing resume: {str(e)}'}
    
    def _extract_text_from_file(self, file_path: str) -> str:
        """Extract text content from various file formats"""
        file_ext = os.path.splitext(file_path)[1].lower()
        
        try:
            if file_ext == '.pdf':
                return self._extract_from_pdf(file_path)
            elif file_ext in ['.docx', '.doc']:
                return self._extract_from_docx(file_path)
            elif file_ext == '.txt':
                return self._extract_from_txt(file_path)
            else:
                raise ValueError(f"Unsupported file type: {file_ext}")
        except Exception as e:
            print(f"Error extracting text from {file_path}: {str(e)}")
            return ""
    
    def _extract_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF file"""
        if not PDF_AVAILABLE:
            raise ImportError("PyPDF2 not available for PDF parsing")
        
        text = ""
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        return text
    
    def _extract_from_docx(self, file_path: str) -> str:
        """Extract text from DOCX file"""
        if not DOCX_AVAILABLE:
            raise ImportError("python-docx not available for DOCX parsing")
        
        doc = docx.Document(file_path)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text
    
    def _extract_from_txt(self, file_path: str) -> str:
        """Extract text from TXT file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        except UnicodeDecodeError:
            # Try with different encoding
            with open(file_path, 'r', encoding='latin-1') as file:
                return file.read()
    
    def _parse_text_content(self, text: str) -> Dict[str, Any]:
        """Parse and extract structured information from text"""
        # Clean and normalize text
        clean_text = self._clean_text(text)
        
        # Extract different types of information
        result = {
            'raw_text': text,
            'skills': self._extract_skills(clean_text),
            'contact_info': self._extract_contact_info(clean_text),
            'experience': self._extract_experience(clean_text),
            'education': self._extract_education(clean_text),
            'summary': self._extract_summary(clean_text)
        }
        
        # Add skill categorization
        result['skills_by_category'] = self._categorize_skills(result['skills'])
        result['skill_count'] = len(result['skills'])
        
        return result
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text content"""
        # Convert to lowercase for better matching
        clean_text = text.lower()
        
        # Remove extra whitespace and newlines
        clean_text = re.sub(r'\s+', ' ', clean_text)
        
        # Remove special characters that might interfere with matching
        clean_text = re.sub(r'[^\w\s\.\,\-\+\#]', ' ', clean_text)
        
        return clean_text.strip()
    
    def _extract_skills(self, text: str) -> List[str]:
        """Extract technical and soft skills from text"""
        found_skills = []
        
        # Look for each skill in the text
        for skill in self.all_skills:
            # Create pattern for whole word matching
            pattern = r'\b' + re.escape(skill.lower()) + r'\b'
            
            if re.search(pattern, text):
                # Add the original capitalized version of the skill
                found_skills.append(skill.title())
        
        # Remove duplicates while preserving order
        unique_skills = []
        seen = set()
        for skill in found_skills:
            if skill.lower() not in seen:
                unique_skills.append(skill)
                seen.add(skill.lower())
        
        return unique_skills
    
    def _categorize_skills(self, skills: List[str]) -> Dict[str, List[str]]:
        """Categorize skills by type"""
        categorized = {
            'programming_languages': [],
            'frameworks': [],
            'databases': [],
            'cloud_platforms': [],
            'tools': [],
            'ai_ml': [],
            'soft_skills': []
        }
        
        skills_lower = [skill.lower() for skill in skills]
        
        for category, skill_list in self.skills_database.items():
            for skill in skills:
                if skill.lower() in skill_list:
                    categorized[category].append(skill)
        
        return categorized
    
    def _extract_contact_info(self, text: str) -> Dict[str, Optional[str]]:
        """Extract contact information"""
        contact_info = {
            'email': None,
            'phone': None,
            'linkedin': None,
            'github': None
        }
        
        # Email pattern
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        email_match = re.search(email_pattern, text)
        if email_match:
            contact_info['email'] = email_match.group()
        
        # Phone pattern (various formats)
        phone_pattern = r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
        phone_match = re.search(phone_pattern, text)
        if phone_match:
            contact_info['phone'] = phone_match.group()
        
        # LinkedIn pattern
        linkedin_pattern = r'linkedin\.com/in/[\w-]+'
        linkedin_match = re.search(linkedin_pattern, text)
        if linkedin_match:
            contact_info['linkedin'] = linkedin_match.group()
        
        # GitHub pattern
        github_pattern = r'github\.com/[\w-]+'
        github_match = re.search(github_pattern, text)
        if github_match:
            contact_info['github'] = github_match.group()
        
        return contact_info
    
    def _extract_experience(self, text: str) -> Dict[str, Any]:
        """Extract work experience information"""
        # Look for years of experience mentions
        exp_patterns = [
            r'(\d+)\+?\s*years?\s*of\s*experience',
            r'(\d+)\+?\s*years?\s*experience',
            r'experience\s*:?\s*(\d+)\+?\s*years?'
        ]
        
        years_experience = 0
        for pattern in exp_patterns:
            match = re.search(pattern, text)
            if match:
                years_experience = max(years_experience, int(match.group(1)))
        
        return {
            'years_of_experience': years_experience,
            'has_experience_section': 'experience' in text or 'work history' in text
        }
    
    def _extract_education(self, text: str) -> Dict[str, Any]:
        """Extract education information"""
        education_keywords = [
            'bachelor', 'master', 'phd', 'doctorate', 'degree', 'university', 'college',
            'b.tech', 'm.tech', 'b.sc', 'm.sc', 'mba', 'engineering'
        ]
        
        found_education = []
        for keyword in education_keywords:
            if keyword in text:
                found_education.append(keyword)
        
        return {
            'education_keywords': found_education,
            'has_education_section': 'education' in text or 'qualification' in text
        }
    
    def _extract_summary(self, text: str) -> str:
        """Extract a brief summary/objective if present"""
        summary_patterns = [
            r'(summary|objective|profile).*?(?=\n.*?\n|\Z)',
            r'(about me|about).*?(?=\n.*?\n|\Z)'
        ]
        
        for pattern in summary_patterns:
            match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
            if match:
                summary = match.group().strip()
                # Limit summary length
                if len(summary) > 300:
                    summary = summary[:300] + "..."
                return summary
        
        # If no explicit summary found, return first few lines
        lines = text.split('\n')[:3]
        return ' '.join(lines)[:200] + "..." if len(' '.join(lines)) > 200 else ' '.join(lines)

    def get_skills_for_job_matching(self, file_path: str, job_keywords: List[str]) -> Dict[str, Any]:
        """
        Get skills from resume that match job requirements
        
        Args:
            file_path: Path to resume file
            job_keywords: List of keywords from job description
            
        Returns:
            Dictionary with matching skills and statistics
        """
        try:
            # Parse resume
            parsed_resume = self.parse_resume(file_path)
            
            if not parsed_resume.get('success'):
                return {
                    'success': False,
                    'error': parsed_resume.get('error'),
                    'relevant_skills': [],
                    'skills_count': 0,
                    'match_percentage': 0
                }
            
            resume_skills = [skill.lower() for skill in parsed_resume.get('skills', [])]
            job_keywords_lower = [keyword.lower().strip() for keyword in job_keywords]
            
            # Find matching skills
            matching_skills = []
            for skill in parsed_resume.get('skills', []):
                skill_lower = skill.lower()
                for keyword in job_keywords_lower:
                    if skill_lower in keyword or keyword in skill_lower:
                        if skill not in matching_skills:
                            matching_skills.append(skill)
                        break
            
            # Calculate match percentage
            total_job_keywords = len(job_keywords_lower)
            matches = len(matching_skills)
            match_percentage = (matches / max(total_job_keywords, 1)) * 100
            
            return {
                'success': True,
                'relevant_skills': matching_skills,
                'all_skills': parsed_resume.get('skills', []),
                'skills_count': len(matching_skills),
                'total_skills': len(parsed_resume.get('skills', [])),
                'match_percentage': round(match_percentage, 2),
                'skills_by_category': parsed_resume.get('skills_by_category', {}),
                'contact_info': parsed_resume.get('contact_info', {}),
                'experience': parsed_resume.get('experience', {})
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Error matching skills: {str(e)}',
                'relevant_skills': [],
                'skills_count': 0,
                'match_percentage': 0
            }

# Global instance for use across the application
resume_parser = ResumeParser()

def parse_resume_file(file_path: str) -> Dict[str, Any]:
    """Convenience function to parse a resume file"""
    return resume_parser.parse_resume(file_path)

def get_resume_skills_for_job(file_path: str, job_keywords: List[str]) -> Dict[str, Any]:
    """Convenience function to get matching skills for a job"""
    return resume_parser.get_skills_for_job_matching(file_path, job_keywords)
