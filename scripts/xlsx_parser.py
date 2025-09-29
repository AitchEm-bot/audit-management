#!/usr/bin/env python3
"""
Excel/CSV Parser for Audit Management System

This module provides functions to read, parse, and clean Excel/CSV files
for audit data processing. No AI logic - pure data parsing only.

Author: Claude Code
Date: 2025-09-29
"""

import pandas as pd
import os
from typing import Dict, Any, List, Optional


def detect_file_type(file_path: str) -> str:
    """
    Detect if file is CSV or Excel based on extension.

    Args:
        file_path: Path to the file

    Returns:
        File type: 'xlsx', 'xls', 'csv', or 'unknown'

    Raises:
        FileNotFoundError: If file doesn't exist
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()

    if ext in ['.xlsx', '.xlsm']:
        return 'xlsx'
    elif ext == '.xls':
        return 'xls'
    elif ext == '.csv':
        return 'csv'
    else:
        return 'unknown'


def read_excel_file(file_path: str, sheet_name: int | str = 0) -> pd.DataFrame:
    """
    Read Excel file and return DataFrame with proper header detection.

    Args:
        file_path: Path to the Excel file
        sheet_name: Sheet name or index (default: first sheet)

    Returns:
        pandas DataFrame

    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: If file cannot be read
    """
    try:
        # First, read without header to inspect the first row
        df_raw = pd.read_excel(file_path, sheet_name=sheet_name, header=None)

        # Drop completely empty rows first
        df_raw = df_raw.dropna(how='all')
        df_raw.reset_index(drop=True, inplace=True)

        # Check if first row looks like a header (contains mostly strings)
        first_row = df_raw.iloc[0]
        string_count = sum(1 for val in first_row if isinstance(val, str))

        # If more than 50% of first row values are strings, treat it as header
        if string_count > len(first_row) * 0.5:
            # Use first row as column names
            column_names = []
            for idx, val in enumerate(first_row):
                if pd.notna(val) and isinstance(val, str) and val.strip():
                    column_names.append(val.strip())
                else:
                    column_names.append(f"Column_{idx}")

            # Set column names and skip first row
            df = df_raw.iloc[1:].copy()
            df.columns = column_names
            df.reset_index(drop=True, inplace=True)

            print(f"✓ Successfully read Excel file: {file_path}")
            print(f"  Rows: {len(df)}, Columns: {len(df.columns)}")
            print(f"  Detected header row, column names: {column_names[:4]}...")
        else:
            # No header detected, use default column names
            df = df_raw
            print(f"✓ Successfully read Excel file: {file_path}")
            print(f"  Rows: {len(df)}, Columns: {len(df.columns)}")
            print(f"  No header row detected")

        return df
    except Exception as e:
        raise ValueError(f"Error reading Excel file: {e}")


def read_csv_file(file_path: str, encoding: str = 'utf-8') -> pd.DataFrame:
    """
    Read CSV file and return DataFrame with automatic encoding detection.

    Args:
        file_path: Path to the CSV file
        encoding: File encoding (default: utf-8, will try alternatives)

    Returns:
        pandas DataFrame

    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: If file cannot be read
    """
    # Try multiple encodings
    encodings_to_try = [encoding, 'latin-1', 'iso-8859-1', 'windows-1252', 'cp1252']

    for enc in encodings_to_try:
        try:
            df = pd.read_csv(file_path, encoding=enc)
            print(f"✓ Successfully read CSV file: {file_path}")
            print(f"  Rows: {len(df)}, Columns: {len(df.columns)}")
            if enc != encoding:
                print(f"  Note: Used encoding '{enc}' instead of '{encoding}'")
            return df
        except UnicodeDecodeError:
            if enc == encodings_to_try[-1]:
                raise ValueError(f"Error reading CSV file: Could not decode with any of {encodings_to_try}")
            continue
        except Exception as e:
            raise ValueError(f"Error reading CSV file: {e}")


def read_file(file_path: str) -> pd.DataFrame:
    """
    Auto-detect file type and read into DataFrame.

    Args:
        file_path: Path to the file

    Returns:
        pandas DataFrame

    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: If file type is unknown or cannot be read
    """
    file_type = detect_file_type(file_path)

    if file_type in ['xlsx', 'xls']:
        return read_excel_file(file_path)
    elif file_type == 'csv':
        return read_csv_file(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean DataFrame: strip whitespace from string columns, standardize headers,
    and remove completely empty rows.

    Args:
        df: Input DataFrame

    Returns:
        Cleaned DataFrame with empty rows removed
    """
    df_clean = df.copy()

    # Strip whitespace from column names (only if they're strings)
    if all(isinstance(col, str) for col in df_clean.columns):
        df_clean.columns = df_clean.columns.str.strip()
    else:
        # Convert column names to strings first
        df_clean.columns = [str(col).strip() if isinstance(col, str) else str(col) for col in df_clean.columns]

    # Strip whitespace from string columns
    for col in df_clean.columns:
        if df_clean[col].dtype == 'object':
            df_clean[col] = df_clean[col].apply(
                lambda x: x.strip() if isinstance(x, str) else x
            )

    # Remove rows where ALL values are null/empty
    rows_before = len(df_clean)
    df_clean = df_clean.dropna(how='all')
    rows_after = len(df_clean)
    rows_removed = rows_before - rows_after

    print(f"✓ DataFrame cleaned")
    if rows_removed > 0:
        print(f"  • Removed {rows_removed} empty rows ({rows_before} → {rows_after})")

    return df_clean


def extract_column_info(df: pd.DataFrame, column_name: str) -> Dict[str, Any]:
    """
    Extract metadata about a specific column.

    Args:
        df: pandas DataFrame
        column_name: Name of the column

    Returns:
        Dictionary with column metadata:
        - name: Column name
        - dtype: Data type
        - non_null_count: Number of non-null values
        - null_count: Number of null values
        - sample_values: List of sample non-null values
        - unique_count: Number of unique values
    """
    if column_name not in df.columns:
        raise ValueError(f"Column '{column_name}' not found in DataFrame")

    col_data = df[column_name]

    # Get non-null values
    non_null_data = col_data.dropna()

    # Get sample values (first 5 + 5 random)
    sample_values = []
    if len(non_null_data) > 0:
        first_samples = non_null_data.head(5).tolist()
        if len(non_null_data) > 5:
            random_samples = non_null_data.sample(
                n=min(5, len(non_null_data)),
                random_state=1
            ).tolist()
            sample_values = list(set([str(v) for v in first_samples + random_samples]))[:10]
        else:
            sample_values = [str(v) for v in first_samples]

    return {
        'name': column_name,
        'dtype': str(col_data.dtype),
        'non_null_count': int(col_data.count()),
        'null_count': int(col_data.isna().sum()),
        'sample_values': sample_values,
        'unique_count': int(col_data.nunique())
    }


def extract_all_columns_info(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Extract metadata for all columns in DataFrame.

    Args:
        df: pandas DataFrame

    Returns:
        List of dictionaries with column metadata
    """
    columns_info = []
    for col in df.columns:
        columns_info.append(extract_column_info(df, col))

    print(f"✓ Extracted info for {len(columns_info)} columns")
    return columns_info


def extract_row_data(
    df: pd.DataFrame,
    title_col: Optional[str] = None,
    description_col: Optional[str] = None,
    department_col: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Extract row data for department classification.

    Args:
        df: pandas DataFrame
        title_col: Name of the title column (optional, auto-detect if None)
        description_col: Name of the description column (optional, auto-detect if None)
        department_col: Name of the department column (optional, auto-detect if None)

    Returns:
        List of dictionaries with row data:
        - row_index: Row number
        - title: Title value (or None)
        - description: Description value (or None)
        - department: Department value (or None)
    """
    rows_data = []

    for idx, row in df.iterrows():
        row_dict = {
            'row_index': int(idx),
            'title': None,
            'description': None,
            'department': None
        }

        # Extract title
        if title_col and title_col in df.columns:
            row_dict['title'] = row[title_col] if pd.notna(row[title_col]) else None

        # Extract description
        if description_col and description_col in df.columns:
            row_dict['description'] = row[description_col] if pd.notna(row[description_col]) else None

        # Extract department
        if department_col and department_col in df.columns:
            row_dict['department'] = row[department_col] if pd.notna(row[department_col]) else None

        rows_data.append(row_dict)

    print(f"✓ Extracted data for {len(rows_data)} rows")
    return rows_data


def get_dataframe_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Get summary statistics for DataFrame.

    Args:
        df: pandas DataFrame

    Returns:
        Dictionary with summary information
    """
    return {
        'total_rows': len(df),
        'total_columns': len(df.columns),
        'column_names': list(df.columns),
        'memory_usage_mb': round(df.memory_usage(deep=True).sum() / 1024**2, 2),
        'has_missing_values': df.isna().any().any(),
        'total_missing_values': int(df.isna().sum().sum())
    }


# Example usage (for testing this module standalone)
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python xlsx_parser.py <file_path>")
        sys.exit(1)

    file_path = sys.argv[1]

    try:
        # Read file
        df = read_file(file_path)

        # Clean DataFrame
        df_clean = clean_dataframe(df)

        # Get summary
        summary = get_dataframe_summary(df_clean)
        print("\n" + "="*80)
        print("DATAFRAME SUMMARY:")
        print("="*80)
        for key, value in summary.items():
            print(f"  {key}: {value}")

        # Extract column info
        print("\n" + "="*80)
        print("COLUMN INFORMATION:")
        print("="*80)
        columns_info = extract_all_columns_info(df_clean)
        for col_info in columns_info:
            print(f"\n  Column: {col_info['name']}")
            print(f"    Type: {col_info['dtype']}")
            print(f"    Non-null: {col_info['non_null_count']}")
            print(f"    Sample values: {col_info['sample_values'][:3]}")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)