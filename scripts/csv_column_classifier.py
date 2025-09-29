#!/usr/bin/env python3
"""
AI-Powered CSV Column Classifier for Audit Management System

This script automatically classifies CSV columns and suggests department mappings
for audit data uploads using LLM-based classification.

Author: Claude Code
Date: 2025-09-29
"""

import pandas as pd
import json
import random
import ollama
from typing import Dict, List, Any, Optional


# ============================================================================
# GLOBAL CONFIGURATION
# ============================================================================

COLUMN_CATEGORIES = [
    'ticket_number',
    'title',
    'description',
    'department',
    'priority',
    'status',
    'due_date',
    'assigned_to',
    'created_at',
    'OTHER'
]

FIXED_DEPARTMENTS = [
    'IT',
    'Finance',
    'HR',
    'Operations',
    'Legal',
    'Compliance',
    'Marketing',
    'Sales',
    'OTHER'
]

CONFIDENCE_THRESHOLD = 0.6


# ============================================================================
# LLAMA3 CLIENT (REAL OLLAMA API)
# ============================================================================

class Llama3Client:
    """
    Real LLM client using Ollama API with Gemma3 model.
    """

    def __init__(self, categories: List[str], departments: List[str], model: str = "gemma3"):
        """
        Initialize the Ollama LLM client.

        Args:
            categories: List of valid column categories
            departments: List of valid departments
            model: Ollama model name (default: gemma3)
        """
        self.categories = categories
        self.departments = departments
        self.model = model

        # Verify Ollama connection
        try:
            ollama.list()
            print(f"✓ Connected to Ollama (model: {model})")
        except Exception as e:
            raise RuntimeError(f"Cannot connect to Ollama. Make sure it's running (ollama serve): {e}")

    def classify_column(self, prompt: str) -> Dict[str, Any]:
        """
        Classify a column using Ollama Gemma3 model.

        Args:
            prompt: The classification prompt

        Returns:
            Dictionary with 'category' and 'confidence'
        """
        try:
            response = ollama.chat(
                model=self.model,
                messages=[{
                    'role': 'user',
                    'content': prompt
                }],
                format='json',
                options={
                    'temperature': 0.3,  # Lower temperature for consistent output
                    'num_predict': 100   # Short response expected
                }
            )

            # Parse JSON response
            result = json.loads(response['message']['content'])

            # Validate response
            if 'category' not in result or 'confidence' not in result:
                raise ValueError("Invalid response format from LLM")

            return result

        except Exception as e:
            print(f"❌ Error calling Ollama: {e}")
            # Fallback to OTHER with zero confidence
            return {
                "category": "OTHER",
                "confidence": 0.0
            }

    def classify_department(self, prompt: str) -> Dict[str, Any]:
        """
        Classify department using Ollama Gemma3 model.

        Args:
            prompt: The classification prompt

        Returns:
            Dictionary with 'department' and 'confidence'
        """
        try:
            response = ollama.chat(
                model=self.model,
                messages=[{
                    'role': 'user',
                    'content': prompt
                }],
                format='json',
                options={
                    'temperature': 0.3,
                    'num_predict': 100
                }
            )

            result = json.loads(response['message']['content'])

            if 'department' not in result or 'confidence' not in result:
                raise ValueError("Invalid response format from LLM")

            return result

        except Exception as e:
            print(f"❌ Error calling Ollama: {e}")
            return {
                "department": "OTHER",
                "confidence": 0.0
            }


# ============================================================================
# PROMPT CREATION FUNCTIONS
# ============================================================================

def create_column_prompt(
    header: str,
    dtype: str,
    sample_values: List[str],
    categories: List[str]
) -> str:
    """
    Generate a structured prompt for column classification.

    Args:
        header: Original column header name
        dtype: Inferred pandas data type
        sample_values: List of sample values from the column
        categories: List of valid categories

    Returns:
        Formatted prompt string
    """
    categories_str = ", ".join([f"'{cat}'" for cat in categories])
    samples_str = json.dumps(sample_values, indent=2)

    prompt = f"""**TASK:** You are an expert data classification engine. Your task is to analyze a column's header and sampled data to assign it to one of the provided fixed categories.

**CONTEXT:**
1.  **FIXED CATEGORIES:** The only valid categories you can return are: {categories_str}. You MUST select one of these. Use 'OTHER' only if the column does not fit any other category.
2.  **DATA DOMAIN:** The data is related to governmental audits and compliance tracking.
3.  **CATEGORY DESCRIPTIONS:**
    - ticket_number: Unique identifier for the audit finding/ticket
    - title: Main title or name of the audit finding
    - description: Detailed description of the audit finding, is usually detailed long text describing the audit finding or observation
    - department: Department or organizational unit
    - priority: Priority, risk level, severity rating, or impact level (examples: low/medium/high/critical, or minor/moderate/major/severe, or 1-5 numeric scale)
    - status: Current status (open, in_progress, resolved, closed, pending, etc.)
    - due_date: Due date, deadline, or target date
    - assigned_to: Person or team assigned to handle the finding
    - created_at: Creation date/timestamp
    - OTHER: Anything that doesn't fit the above categories

**IMPORTANT INSTRUCTIONS:**
- Use SEMANTIC UNDERSTANDING: Recognize synonyms and similar concepts (e.g., 'Rating' can mean 'Priority', 'Moderate' equals 'Medium', 'Severity' equals 'Priority', 'Target Date' equals 'Due Date')
- Focus on the PATTERN and MEANING of the sampled values, not exact word matches
- Prioritize sample data content over header name when making classification decisions
- If sample values clearly indicate a category (e.g., low/high/moderate values indicate priority), classify accordingly even if the header name differs

**INPUT DATA:**
* Original Header: "{header}"
* Inferred Data Type: "{dtype}"
* Sampled Values: {samples_str}

**OUTPUT REQUIREMENTS (STRICT):**
1.  **Classification:** Select the SINGLE best-fit category based on semantic meaning.
2.  **Confidence Score:** Provide a score from 0.0 to 1.0 (float).
3.  **Format:** You MUST return the output as a single, valid JSON object with the keys 'category' and 'confidence'. DO NOT include any other text, explanation, or markdown formatting outside of the JSON block.

**EXAMPLE OUTPUT:**
{{"category": "title", "confidence": 0.95}}
"""
    return prompt


def create_department_prompt(
    department_value: Optional[str],
    title: Optional[str],
    description: Optional[str],
    departments: List[str]
) -> str:
    """
    Generate a structured prompt for department classification.

    Args:
        department_value: Original department value (may be empty)
        title: Audit title
        description: Audit description
        departments: List of valid fixed departments

    Returns:
        Formatted prompt string
    """
    departments_str = ", ".join([f"'{dept}'" for dept in departments])

    if department_value and str(department_value).strip():
        task_type = "normalize and map"
        input_section = f"""* Original Department Value: "{department_value}"
* Audit Title: "{title or 'N/A'}"
* Audit Description: "{description or 'N/A'}"

**YOUR TASK:** Map the original department value to one of the fixed departments. If the original value clearly matches or is similar to one of the fixed departments, map it. Otherwise, use the title and description as context."""
    else:
        task_type = "infer from content"
        input_section = f"""* Original Department Value: [EMPTY]
* Audit Title: "{title or 'N/A'}"
* Audit Description: "{description or 'N/A'}"

**YOUR TASK:** The department field is empty. Analyze the audit title and description to infer the most appropriate department from the fixed list."""

    prompt = f"""**TASK:** You are an expert department classification engine. Your task is to {task_type} a department for audit findings.

**CONTEXT:**
1.  **FIXED DEPARTMENTS:** The only valid departments you can return are: {departments_str}. You MUST select one of these. Use 'OTHER' only if you cannot confidently determine the department.
2.  **DATA DOMAIN:** The data is related to governmental audits and compliance.
3.  **DEPARTMENT DESCRIPTIONS:**
    - IT: Information Technology, systems, software, infrastructure
    - Finance: Accounting, budgets, financial controls, procurement
    - HR: Human Resources, personnel, recruitment, training
    - Operations: Business operations, processes, logistics
    - Legal: Legal compliance, contracts, regulations
    - Compliance: Regulatory compliance, audit controls, risk management
    - Marketing: Marketing, communications, public relations
    - Sales: Sales, revenue, customer relations
    - OTHER: Cannot determine or doesn't fit above categories

**INPUT DATA:**
{input_section}

**OUTPUT REQUIREMENTS (STRICT):**
1.  **Classification:** Select the SINGLE best-fit department.
2.  **Confidence Score:** Provide a score from 0.0 to 1.0 (float).
3.  **Format:** You MUST return the output as a single, valid JSON object with the keys 'department' and 'confidence'. DO NOT include any other text, explanation, or markdown formatting outside of the JSON block.

**EXAMPLE OUTPUT:**
{{"department": "IT", "confidence": 0.88}}
"""
    return prompt


# ============================================================================
# PROCESSING FUNCTIONS
# ============================================================================

def process_column(
    df_column: pd.Series,
    column_name: str,
    llama_client: Llama3Client,
    categories: List[str]
) -> Dict[str, Any]:
    """
    Process a single column to classify its category.

    Args:
        df_column: Pandas Series representing the column
        column_name: Name of the column
        llama_client: LLM client instance
        categories: List of valid categories

    Returns:
        Dictionary with classification results
    """
    # Get data type
    dtype = str(df_column.dtype)

    # Sample data: first 5 + 5 random non-null values
    non_null_column = df_column.dropna()

    if len(non_null_column) == 0:
        # Empty column - default to OTHER with low confidence
        return {
            "category": "OTHER",
            "confidence": 0.0,
            "needs_manual_review": True,
            "reason": "Column is empty"
        }

    # Get first 5 values
    first_samples = non_null_column.head(5).tolist()

    # Get 5 random values (with reproducible seed)
    sample_size = min(5, len(non_null_column))
    random_samples = non_null_column.sample(n=sample_size, random_state=1).tolist()

    # Combine and deduplicate
    all_samples = list(set([str(s) for s in first_samples + random_samples]))

    # Limit to 10 samples max
    sample_values = all_samples[:10]

    # Create prompt and classify
    prompt = create_column_prompt(column_name, dtype, sample_values, categories)
    result = llama_client.classify_column(prompt)

    # Check confidence threshold
    needs_review = result['confidence'] < CONFIDENCE_THRESHOLD
    if needs_review:
        result['category'] = 'OTHER'
        result['needs_manual_review'] = True
        result['reason'] = f"Low confidence ({result['confidence']})"
    else:
        result['needs_manual_review'] = False

    return result


def process_department(
    row_index: int,
    department_value: Optional[str],
    title: Optional[str],
    description: Optional[str],
    llama_client: Llama3Client,
    departments: List[str]
) -> Dict[str, Any]:
    """
    Process department classification for a single row.

    Args:
        row_index: Index of the row
        department_value: Original department value (may be empty)
        title: Audit title
        description: Audit description
        llama_client: LLM client instance
        departments: List of valid departments

    Returns:
        Dictionary with classification results
    """
    # Create prompt and classify
    prompt = create_department_prompt(department_value, title, description, departments)
    result = llama_client.classify_department(prompt)

    # Add metadata
    result['row'] = row_index
    result['original'] = department_value if department_value else ""
    result['suggested'] = result['department']

    # Determine source
    if department_value and str(department_value).strip():
        result['source'] = 'normalized'
    else:
        result['source'] = 'inferred_from_content'

    # Check confidence threshold
    needs_review = result['confidence'] < CONFIDENCE_THRESHOLD
    if needs_review:
        result['suggested'] = 'OTHER'
        result['needs_manual_review'] = True
        result['reason'] = f"Low confidence ({result['confidence']})"
    else:
        result['needs_manual_review'] = False

    return result


# ============================================================================
# END OF CLASSIFICATION LIBRARY
# ============================================================================
#
# This module provides AI-powered classification functions for audit data.
# Import and use these functions in your own scripts:
#
# from csv_column_classifier import (
#     Llama3Client,
#     COLUMN_CATEGORIES,
#     FIXED_DEPARTMENTS,
#     CONFIDENCE_THRESHOLD,
#     process_column,
#     process_department
# )
#
# ============================================================================