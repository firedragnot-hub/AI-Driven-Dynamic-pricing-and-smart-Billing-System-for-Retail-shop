import os
import sys

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_RIGHT, TA_LEFT
    from reportlab.pdfgen import canvas
except ImportError:
    print("ReportLab is not installed.")
    sys.exit(1)

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_elements(num_pages)
            super().showPage()
        super().save()

    def draw_page_elements(self, page_count):
        width, height = A4
        left_margin = 108  # 1.5 inches
        right_margin = 72  # 1.0 inch
        
        if self._pageNumber == 1:
            return
            
        self.saveState()
        
        # Header (0.5 inch from top = height - 36 pt)
        self.setFont("Times-Italic", 9)
        self.drawRightString(width - right_margin, height - 36, "AI-Driven Dynamic Pricing and Smart Billing System")
        self.setStrokeColorRGB(0.8, 0.8, 0.8)
        self.setLineWidth(0.5)
        self.line(left_margin, height - 42, width - right_margin, height - 42)
        
        # Footer (0.5 inch from bottom = 36 pt)
        self.setFont("Times-Roman", 9)
        self.drawString(left_margin, 36, "CSE DEPARTMENT")
        self.drawRightString(width - right_margin, 36, str(self._pageNumber))
        self.line(left_margin, 48, width - right_margin, 48)
        
        self.restoreState()

def build_pdf(filename="Project_Synopsis.pdf"):
    # Margins: Top: 1", Bottom: 1", Right: 1", Left: 1.5"
    left_margin = 1.5 * inch
    right_margin = 1.0 * inch
    top_margin = 1.0 * inch
    bottom_margin = 1.0 * inch
    
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=left_margin,
        rightMargin=right_margin,
        topMargin=top_margin,
        bottomMargin=bottom_margin
    )
    
    styles = getSampleStyleSheet()
    
    # Guidelines Style Definitions: Size 12, line spacing 1.5 (leading 18 pt), justified
    body_style = ParagraphStyle(
        'SynopsisBody',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=12,
        leading=18,
        alignment=TA_JUSTIFY,
        spaceAfter=10
    )
    
    pre_style = ParagraphStyle(
        'SynopsisPre',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=10,
        leading=13,
        alignment=TA_LEFT,
        spaceAfter=10
    )
    
    subheading_style = ParagraphStyle(
        'SynopsisSub',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=14,
        leading=20,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )
    
    # Chapter Headings: Center, Bold, Underlined, Size 18
    chapter_style = ParagraphStyle(
        'SynopsisChapter',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=18,
        leading=24,
        alignment=TA_CENTER,
        spaceBefore=20,
        spaceAfter=15,
        keepWithNext=True
    )
    
    story = []
    
    # ==================== PAGE 1: COVER PAGE ====================
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=20,
        leading=28,
        alignment=TA_CENTER,
        spaceAfter=20
    )
    
    story.append(Spacer(1, 40))
    story.append(Paragraph("A PROJECT SYNOPSIS REPORT ON", ParagraphStyle('CovSub1', fontName='Times-Roman', fontSize=12, alignment=TA_CENTER)))
    story.append(Spacer(1, 15))
    story.append(Paragraph("AI-DRIVEN DYNAMIC PRICING AND SMART BILLING SYSTEM FOR RETAIL SHOP", title_style))
    story.append(Spacer(1, 40))
    story.append(Paragraph("SUBMITTED IN PARTIAL FULFILLMENT OF THE REQUIREMENTS FOR THE DEGREE OF", ParagraphStyle('CovSub2', fontName='Times-Roman', fontSize=11, alignment=TA_CENTER)))
    story.append(Spacer(1, 15))
    story.append(Paragraph("BACHELOR OF TECHNOLOGY", ParagraphStyle('CovSub3', fontName='Times-Bold', fontSize=14, alignment=TA_CENTER)))
    story.append(Paragraph("IN<br/>COMPUTER SCIENCE & ENGINEERING", ParagraphStyle('CovSub4', fontName='Times-Bold', fontSize=12, alignment=TA_CENTER)))
    
    story.append(Spacer(1, 80))
    story.append(Paragraph("<b>SUBMITTED BY:</b>", ParagraphStyle('CovSub5', fontName='Times-Roman', fontSize=12, alignment=TA_CENTER)))
    story.append(Spacer(1, 8))
    story.append(Paragraph("<b>AMAN SINGH</b>", ParagraphStyle('CovSub6', fontName='Times-Bold', fontSize=13, alignment=TA_CENTER)))
    story.append(Paragraph("Roll No: 2301220100034", ParagraphStyle('CovSub7', fontName='Times-Roman', fontSize=12, alignment=TA_CENTER)))
    
    story.append(Spacer(1, 100))
    story.append(Paragraph("DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING", ParagraphStyle('CovFoot1', fontName='Times-Bold', fontSize=12, alignment=TA_CENTER)))
    story.append(Paragraph("YEAR 2026", ParagraphStyle('CovFoot2', fontName='Times-Roman', fontSize=12, alignment=TA_CENTER)))
    story.append(PageBreak())
    
    # ==================== PAGE 2: INTRODUCTION & PROBLEM DEFINITION ====================
    story.append(Paragraph("<u><b>1. INTRODUCTION</b></u>", chapter_style))
    story.append(Paragraph(
        "In modern retail business paradigms, static pricing represents a major bottleneck to profit maximization. "
        "Traditional brick-and-mortar stores rely on manual markups, which fail to react to instantaneous shifts in competitor prices, "
        "stock availability, or holiday demand spikes. Concurrently, manual Point-of-Sale (POS) transactions result in slow billing "
        "queues during peak shopping hours. This project introduces an integrated system that addresses both challenges by combining "
        "machine learning dynamic pricing algorithms with a highly responsive billing interface and automatic GST audit reporting.",
        body_style
    ))
    
    story.append(Paragraph("<u><b>2. PROBLEM DEFINITION</b></u>", chapter_style))
    story.append(Paragraph(
        "Existing store billing systems run as isolated databases, leading to mismatches between stock level tracking and purchase "
        "invoices. Manual entry errors result in inaccurate sales logs and complex auditing cycles during tax filings. Furthermore, "
        "static pricing does not allow store managers to quickly apply discounts to clearance items or capture higher margins "
        "on high-demand goods. The objective is to design a unified retail application that bridges transaction registers, "
        "dynamic pricing algorithms, and tax compliance automation.",
        body_style
    ))
    story.append(PageBreak())
    
    # ==================== PAGE 3: OBJECTIVES & METHODOLOGY ====================
    story.append(Paragraph("<u><b>3. PROJECT OBJECTIVES</b></u>", chapter_style))
    story.append(Paragraph(
        "The system aims to accomplish the following goals:<br/>"
        "• To create a Point-of-Sale (POS) terminal that manages billing and processes checkout inputs in sub-second intervals.<br/>"
        "• To build regression pipelines that dynamically calculate pricing based on inventory levels, historical patterns, and holiday calendars.<br/>"
        "• To automate monthly GST audit logs (GSTR-1 and GSTR-3B filings) and purchase bill PDF alignment on a serverless Neon database.",
        body_style
    ))
    
    story.append(Paragraph("<u><b>4. PROPOSED METHODOLOGY</b></u>", chapter_style))
    story.append(Paragraph(
        "The application follows a three-tier architecture model consisting of a React.js client interface, a Python Flask API, "
        "and a Neon serverless PostgreSQL database. Transactions, orders, and expenses are aggregated directly in the database using SQL "
        "groupings to ensure fast response times on serverless environments.",
        body_style
    ))
    
    # Methodology Block Diagram Description
    story.append(Paragraph("4.1 Process Flow Block Diagram", subheading_style))
    story.append(Paragraph(
        "The operational workflow is divided into three processing blocks:<br/>"
        "1. <b>Data Collection & POS:</b> Standard product scan operations feed transaction logs into the PostgreSQL database.<br/>"
        "2. <b>AI Price Optimizations:</b> The demand model runs scikit-learn forecasting to recommend selling prices.<br/>"
        "3. <b>Compliance Verification:</b> The audit engine processes tax rates, checks HSN codes, and auto-aligns uploaded invoice files.",
        body_style
    ))
    story.append(PageBreak())
    
    # ==================== PAGE 4: RELATED TECHNOLOGY & SYSTEM REQUIREMENTS ====================
    story.append(Paragraph("<u><b>5. RELATED TECHNOLOGY & CONCEPTS</b></u>", chapter_style))
    story.append(Paragraph(
        "The system utilizes several modern software concepts:<br/>"
        "• <b>SQL-Side Aggregations:</b> To bypass ORM instantiation overhead and prevent network timeouts on serverless functions.<br/>"
        "• <b>Dynamic Pricing Models:</b> Using scikit-learn regression to model elasticities and predict item pricing patterns.<br/>"
        "• <b>Digital PDF Auditing:</b> Implementing text block parsers (pypdf) to automatically reconcile seller bills.",
        body_style
    ))
    
    story.append(Paragraph("<u><b>6. HARDWARE & SOFTWARE SPECIFICATIONS</b></u>", chapter_style))
    story.append(Paragraph("6.1 Software Requirements", subheading_style))
    story.append(Paragraph(
        "• Development Environment: Node.js v18.0+, Python v3.10+, and pip package manager<br/>"
        "• Database Management System: Neon Serverless PostgreSQL and SQLite<br/>"
        "• Frameworks: Flask v3.0, SQLAlchemy v2.0, React JS, scikit-learn, and reportlab",
        body_style
    ))
    
    story.append(Paragraph("6.2 Hardware Specifications", subheading_style))
    story.append(Paragraph(
        "• CPU Processor: Quad-core Intel Core i5 or AMD Ryzen 5 (2.5 GHz base frequency minimum)<br/>"
        "• System Memory: 8 GB DDR4 RAM minimum (16 GB recommended)<br/>"
        "• Storage Space: 5 GB available Solid State Drive (SSD)",
        body_style
    ))
    story.append(PageBreak())
    
    # ==================== PAGE 5: MODULES & DATA FLOW DIAGRAMS ====================
    story.append(Paragraph("<u><b>7. MODULE DESCRIPTION</b></u>", chapter_style))
    
    story.append(Paragraph("7.1 Authentication & POS Module", subheading_style))
    story.append(Paragraph(
        "Provides role-based access control. The POS submodule processes scans, updates inventory registers, "
        "and handles cash/card payment logs.",
        body_style
    ))
    
    story.append(Paragraph("7.2 ML Pricing Module", subheading_style))
    story.append(Paragraph(
        "Foretells demand and calculates recommended pricing. The suggested prices are calculated based on competitor prices, "
        "current inventory levels, and holiday calendars.",
        body_style
    ))
    
    story.append(Paragraph("7.3 GST & Bill Verification Module", subheading_style))
    story.append(Paragraph(
        "Compiles sales tax records, audits HSN codes, and matches uploaded invoice files against internal order records, "
        "flagging discrepancies instantly.",
        body_style
    ))
    
    story.append(Paragraph("7.4 Data Flow Diagram (0-Level)", subheading_style))
    story.append(Paragraph(
        "The 0-level DFD represents the entire application as a single process. Store cashiers enter scan logs into the "
        "system, while the manager uploads supplier bills. The system processes these inputs and outputs digital invoices, "
        "GSTR-1/3B audit reports, and dynamic price recommendations.",
        body_style
    ))
    story.append(PageBreak())
    
    # ==================== PAGE 6: APPLICATIONS, COST & REFERENCES ====================
    story.append(Paragraph("<u><b>8. APPLICATIONS, ADVANTAGES & COSTS</b></u>", chapter_style))
    
    story.append(Paragraph("8.1 Applications and Advantages", subheading_style))
    story.append(Paragraph(
        "• <b>Applications:</b> Suitable for supermarkets, hardware retail shops, and electronic distributors.<br/>"
        "• <b>Advantages:</b> Increases margins through dynamic pricing, reduces checkout delays, and flags compliance anomalies early.",
        body_style
    ))
    
    story.append(Paragraph("8.2 Proposed Cost & Resources", subheading_style))
    story.append(Paragraph(
        "The system utilizes open-source software libraries, reducing software licensing costs to zero. "
        "Hosting is managed using Vercel's serverless free tier and Neon serverless PostgreSQL, making "
        "operational and maintenance costs extremely low.",
        body_style
    ))
    
    story.append(Paragraph("<u><b>9. REFERENCES</b></u>", chapter_style))
    story.append(Paragraph(
        "[1] A. Kumar and B. Verma, 'Dynamic Pricing Frameworks in Retail E-Commerce using Machine Learning,' <i>Journal of Business Analytics</i>, vol. 14, no. 2, pp. 112-124, 2024.<br/><br/>"
        "[2] S. Gupta, 'Automated GST Compliance Systems for Small and Medium Enterprises,' <i>International Journal of Tax Technology</i>, vol. 8, pp. 45-56, 2025.<br/><br/>"
        "[3] M. Johnson, 'Performance Optimization in Relational Databases: SQL-side Aggregations vs ORM Instantiations,' <i>Computing & Information Letters</i>, vol. 22, no. 1, pp. 89-102, 2024.",
        ParagraphStyle('RefBodyFinal', parent=styles['Normal'], fontName='Times-Roman', fontSize=11, leading=15, alignment=TA_LEFT)
    ))
    
    doc.build(story, canvasmaker=NumberedCanvas)

if __name__ == "__main__":
    build_pdf()
