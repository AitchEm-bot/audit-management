#!/usr/bin/env python3
"""
Main Orchestration Script for CSV Column Classification

This script reads Excel/CSV files, classifies columns using AI, and suggests
department mappings for audit data.

Usage:
    python run_classifier.py <file_path>

Example:
    python run_classifier.py test_data.xlsx

Author: Claude Code
Date: 2025-09-30
"""

import sys
import json
import os
from typing import Dict, List, Any

# Import parsing functions
from xlsx_parser import (
    read_file,
    clean_dataframe,
    extract_all_columns_info,
    extract_row_data,
    get_dataframe_summary
)

# Import classification functions
from csv_column_classifier import (
    Llama3Client,
    COLUMN_CATEGORIES,
    FIXED_DEPARTMENTS,
    CONFIDENCE_THRESHOLD,
    process_column,
    process_department
)


def main():
    """Main execution function"""

    # Check command line arguments
    if len(sys.argv) < 2:
        print("Usage: python run_classifier.py <file_path>")
        print("\nExample:")
        print("  python run_classifier.py test_data.xlsx")
        sys.exit(1)

    file_path = sys.argv[1]

    # Validate file exists
    if not os.path.exists(file_path):
        print(f"❌ Error: File not found: {file_path}")
        sys.exit(1)

    print("="*80)
    print("AI-POWERED CSV COLUMN CLASSIFIER")
    print("="*80)
    print(f"\nProcessing file: {file_path}\n")

    try:
        # ====================================================================
        # STEP 1: READ AND PARSE FILE
        # ====================================================================
        print("\n[STEP 1] Reading and parsing file...")
        df = read_file(file_path)
        df_clean = clean_dataframe(df)

        # Get summary
        summary = get_dataframe_summary(df_clean)
        print(f"\n📊 File Summary:")
        print(f"  • Total Rows: {summary['total_rows']}")
        print(f"  • Total Columns: {summary['total_columns']}")
        print(f"  • Memory Usage: {summary['memory_usage_mb']} MB")
        print(f"  • Has Missing Values: {summary['has_missing_values']}")

        # ====================================================================
        # STEP 2: INITIALIZE AI CLIENT
        # ====================================================================
        print("\n[STEP 2] Initializing Ollama AI client...")
        llama_client = Llama3Client(
            categories=COLUMN_CATEGORIES,
            departments=FIXED_DEPARTMENTS,
            model="gemma3"
        )

        # ====================================================================
        # STEP 3: CLASSIFY COLUMNS
        # ====================================================================
        print("\n[STEP 3] Classifying columns using AI...")
        print(f"  Total columns to classify: {len(df_clean.columns)}")
        print(f"  Confidence threshold: {CONFIDENCE_THRESHOLD}\n")

        column_classifications = []

        for idx, col_name in enumerate(df_clean.columns, 1):
            result = process_column(
                df_column=df_clean[col_name],
                column_name=col_name,
                llama_client=llama_client,
                categories=COLUMN_CATEGORIES
            )

            result['original_name'] = col_name
            column_classifications.append(result)

            # Print result
            status_icon = "⚠️" if result.get('needs_manual_review', False) else "✅"
            review_note = f" [NEEDS REVIEW: {result.get('reason', 'Low confidence')}]" if result.get('needs_manual_review', False) else ""
            print(f"{status_icon} {col_name} → {result['category']} (confidence: {result['confidence']:.2f}){review_note}")

        # ====================================================================
        # STEP 4: BUILD COLUMN MAPPING
        # ====================================================================
        print("\n[STEP 4] Building column mapping...")

        column_mapping = {}
        for classification in column_classifications:
            if classification['category'] != 'OTHER':
                column_mapping[classification['category']] = classification['original_name']

        print("\n📋 Column Mapping:")
        for category, original_name in column_mapping.items():
            print(f"  • {category} ← '{original_name}'")

        # Check for unmapped required fields
        unmapped = [cat for cat in ['title', 'description', 'department'] if cat not in column_mapping]
        if unmapped:
            print(f"\n⚠️  Warning: Missing required fields: {', '.join(unmapped)}")

        # ====================================================================
        # STEP 5: CLASSIFY DEPARTMENTS (ROW-BY-ROW)
        # ====================================================================
        print("\n[STEP 5] Classifying departments for each row...")

        # Extract row data using mapped columns
        title_col = column_mapping.get('title')
        description_col = column_mapping.get('description')
        department_col = column_mapping.get('department')

        rows_data = extract_row_data(
            df=df_clean,
            title_col=title_col,
            description_col=description_col,
            department_col=department_col
        )

        print(f"  Total rows to process: {len(rows_data)}")
        print(f"  Processing first 5 rows as sample...\n")

        department_classifications = []

        # Process only first 5 rows for demonstration (change to process all if needed)
        sample_size = min(5, len(rows_data))

        for idx, row_data in enumerate(rows_data[:sample_size], 1):
            result = process_department(
                row_index=row_data['row_index'],
                department_value=row_data['department'],
                title=row_data['title'],
                description=row_data['description'],
                llama_client=llama_client,
                departments=FIXED_DEPARTMENTS
            )

            department_classifications.append(result)

            # Print result
            status_icon = "⚠️" if result.get('needs_manual_review', False) else "✅"
            source_label = "normalized" if result['source'] == 'normalized' else "inferred"
            review_note = f" [NEEDS REVIEW: {result.get('reason', 'Low confidence')}]" if result.get('needs_manual_review', False) else ""
            print(f"{status_icon} Row {row_data['row_index']}: {result['original'] or '[empty]'} → {result['suggested']} ({source_label}, conf: {result['confidence']:.2f}){review_note}")

        # ====================================================================
        # STEP 6: GENERATE OUTPUT
        # ====================================================================
        print("\n[STEP 6] Generating output...")

        # Convert summary booleans to JSON-serializable format
        summary_json = summary.copy()
        summary_json['has_missing_values'] = bool(summary_json['has_missing_values'])

        output = {
            'file_path': file_path,
            'file_summary': summary_json,
            'column_classifications': column_classifications,
            'column_mapping': column_mapping,
            'department_classifications': department_classifications,
            'statistics': {
                'total_columns': len(column_classifications),
                'columns_classified': len([c for c in column_classifications if c['category'] != 'OTHER']),
                'columns_needing_review': len([c for c in column_classifications if c.get('needs_manual_review', False)]),
                'total_rows_processed': len(department_classifications),
                'departments_normalized': len([d for d in department_classifications if d['source'] == 'normalized']),
                'departments_inferred': len([d for d in department_classifications if d['source'] == 'inferred_from_content']),
                'departments_needing_review': len([d for d in department_classifications if d.get('needs_manual_review', False)])
            }
        }

        # Save to JSON file
        output_file = file_path.rsplit('.', 1)[0] + '_classification_results.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        print(f"\n✅ Results saved to: {output_file}")

        # ====================================================================
        # FINAL SUMMARY
        # ====================================================================
        print("\n" + "="*80)
        print("CLASSIFICATION COMPLETE")
        print("="*80)
        print(f"\n📊 Statistics:")
        print(f"  • Columns Classified: {output['statistics']['columns_classified']}/{output['statistics']['total_columns']}")
        print(f"  • Columns Needing Review: {output['statistics']['columns_needing_review']}")
        print(f"  • Rows Processed: {output['statistics']['total_rows_processed']}")
        print(f"  • Departments Normalized: {output['statistics']['departments_normalized']}")
        print(f"  • Departments Inferred: {output['statistics']['departments_inferred']}")
        print(f"  • Departments Needing Review: {output['statistics']['departments_needing_review']}")

        print(f"\n✅ Classification results saved to: {output_file}")
        print("\n" + "="*80)

    except Exception as e:
        print(f"\n❌ Error during processing: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()