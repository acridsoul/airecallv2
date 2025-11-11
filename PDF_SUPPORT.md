# PDF Processing Support

## Overview
Your AI chatbot now has **full PDF processing support** across all AI models (DeepSeek, Claude Sonnet 4, and Gemini).

## How It Works

### 📄 PDF Text Extraction
- PDFs are automatically processed server-side using the `pdf-parse` library
- Text content is extracted and sent to AI models that don't natively support PDFs
- This enables all models to analyze and understand PDF documents

### 🤖 Model-Specific Handling

#### **DeepSeek** (Text Only)
- ✅ **PDFs**: Supported via text extraction
- ❌ **Images**: Not supported (text-only model)
- PDF content is extracted and sent as plain text

#### **Claude Sonnet 4** (Multimodal)
- ✅ **PDFs**: Supported via text extraction
- ✅ **Images**: Fully supported (PNG, JPG, JPEG)
- PDF text is extracted and combined with any accompanying message text

#### **Gemini 2.5 Flash** (Multimodal + Native PDF)
- ✅ **PDFs**: Natively supported (sent as file attachments)
- ✅ **Images**: Fully supported (PNG, JPG, JPEG)
- Uses Google's native PDF processing capabilities

## Technical Changes

### 1. Runtime Change
```typescript
// Changed from 'edge' to 'nodejs' to support PDF parsing
export const runtime = 'nodejs'
```

### 2. PDF Text Extraction Function
```typescript
async function extractPdfText(dataUrl: string): Promise<string>
```
- Converts base64 data URLs to Buffer
- Extracts text using pdf-parse library
- Returns extracted text or error message

### 3. Message Processing
- **History messages**: PDFs in conversation history are processed and their text extracted
- **Current message**: New PDF uploads are processed in real-time
- **Format**: `[PDF Document: filename.pdf]\n\n{extracted_text}`

### 4. Smart Model Detection
```typescript
if (model === 'Gemini') {
  // Use native PDF support
} else {
  // Extract text for DeepSeek and Claude
}
```

## Usage

### For Users
1. **Upload a PDF**: Click the + button in the composer
2. **Select your PDF file**: Maximum 10MB
3. **Add a message** (optional): "Analyze this document" or "Summarize the key points"
4. **Send**: The AI will process the PDF content and respond

### File Restrictions
- **Supported formats**: PNG, JPG, JPEG, PDF
- **Maximum size**: 10MB per file
- **Multiple files**: Supported (can upload multiple PDFs/images at once)

## Benefits

### ✅ Universal PDF Support
- All three AI models can now analyze PDFs
- No need to switch models for PDF processing

### ✅ Better Text Extraction
- Preserves document structure and formatting
- Includes all text content from the PDF
- Works with multi-page documents

### ✅ Context Preservation
- PDF content is included in conversation history
- AI can reference PDF content in follow-up questions
- Maintains conversation context across messages

## Example Workflows

### 1. Document Analysis
```
User: [Uploads assignment_template.pdf]
      "Can you analyze the structure of this document?"

AI: [Processes extracted PDF text]
    "This document is a structured assignment template with the following sections..."
```

### 2. Data Extraction
```
User: [Uploads report.pdf]
      "Extract all the key findings from this report"

AI: [Analyzes PDF text]
    "Key findings from the document:
     1. ...
     2. ..."
```

### 3. Multi-File Analysis
```
User: [Uploads report.pdf + chart.png]
      "Compare the data in these two files"

AI: [Processes both PDF text and image]
    "Comparing the report data with the chart..."
```

## Troubleshooting

### PDF Processing Failed
- **Check file size**: Must be under 10MB
- **Verify format**: Must be a valid PDF file
- **Check corruption**: Ensure PDF is not corrupted
- **Server logs**: Check console for detailed error messages

### Text Extraction Issues
- Some PDFs (scanned images) may have poor text extraction
- For image-based PDFs, consider using OCR tools first
- Complex formatting may not be perfectly preserved

## Future Enhancements

Potential improvements:
- [ ] OCR support for scanned/image-based PDFs
- [ ] PDF page-by-page processing for very large documents
- [ ] Enhanced table and chart extraction
- [ ] Support for more document formats (DOCX, TXT, etc.)

## Dependencies

- **pdf-parse**: ^2.4.5 - PDF text extraction library
- **Node.js runtime**: Required for pdf-parse (changed from edge)

---

**Last Updated**: 2025-01-11
**Status**: ✅ Fully Operational

