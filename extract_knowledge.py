import os
import glob
import json
import pypdfium2 as pdfium

def extract_text_from_pdfs(directory="."):
    knowledge_base = []
    pdf_files = glob.glob(os.path.join(directory, "*.pdf"))
    
    print(f"Found {len(pdf_files)} PDF files.")
    
    for pdf_path in pdf_files:
        filename = os.path.basename(pdf_path)
        print(f"Processing: {filename}")
        
        try:
            pdf = pdfium.PdfDocument(pdf_path)
            full_text = ""
            for i in range(len(pdf)):
                page = pdf[i]
                text_page = page.get_textpage()
                text = text_page.get_text_range()
                full_text += text + "\n"
                
            knowledge_base.append({
                "source": filename,
                "content": full_text
            })
        except Exception as e:
            print(f"Error processing {filename}: {e}")
            
    return knowledge_base

if __name__ == "__main__":
    kb = extract_text_from_pdfs()
    
    # Ensure the output directory exists
    output_dir = os.path.join("ai-consultant-web", "data")
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, "knowledge_base.json")
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(kb, f, ensure_ascii=False, indent=2)
    print(f"Successfully extracted text from {len(kb)} files to {output_path}")
