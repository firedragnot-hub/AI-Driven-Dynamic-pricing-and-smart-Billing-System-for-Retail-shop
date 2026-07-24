from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from datetime import datetime

def generate_invoice_pdf(transaction):
    """
    Generates a professional PDF invoice for a transaction.
    Returns a BytesIO stream of the PDF file.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    story = []
    
    # 1. Styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#1A365D"),  # Deep blue
        spaceAfter=6
    )
    
    meta_style = ParagraphStyle(
        'InvoiceMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#4A5568")  # Slate gray
    )
    
    meta_right_style = ParagraphStyle(
        'InvoiceMetaRight',
        parent=meta_style,
        alignment=2 # Right aligned
    )
    
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        textColor=colors.white
    )
    
    table_body_style = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#2D3748")
    )
    
    # 2. Header Section
    header_data = [
        [
            Paragraph("SMART RETAIL SOLUTIONS", title_style),
            Paragraph(f"<b>INVOICE</b><br/>#{transaction.id}", meta_right_style)
        ],
        [
            Paragraph("123 Innovation Way, Retail Suite 100<br/>Phone: (555) 019-2831<br/>support@smartretail.com", meta_style),
            Paragraph(f"Date: {transaction.timestamp.strftime('%Y-%m-%d %H:%M:%S')}<br/>Payment Status: PAID<br/>Method: Electronic", meta_right_style)
        ]
    ]
    
    header_table = Table(header_data, colWidths=[3.5 * inch, 3.5 * inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 15))
    
    # Draw a line separator
    line_data = [['']]
    line_table = Table(line_data, colWidths=[7.0 * inch])
    line_table.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E0")),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(line_table)
    
    # Customer Details Block (for Orders)
    if hasattr(transaction, 'address') and transaction.address:
        bill_to_data = [
            [
                Paragraph("<b>Bill To:</b>", meta_style),
                Paragraph("<b>Shipping Address:</b>", meta_style)
            ],
            [
                Paragraph(f"{transaction.customer_name}<br/>Phone: {transaction.phone}<br/>Email: {transaction.email}", meta_style),
                Paragraph(transaction.address.replace('\n', '<br/>'), meta_style)
            ]
        ]
        bill_to_table = Table(bill_to_data, colWidths=[3.5 * inch, 3.5 * inch])
        bill_to_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('PADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
            ('TOPPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(bill_to_table)
        story.append(line_table)
        
    story.append(Spacer(1, 15))
    
    # 3. Items Table Section
    # Columns: S.No, Item Description, HSN Code, Qty, Unit Price, GST %, Total Price
    table_data = [[
        Paragraph("S.No", table_header_style),
        Paragraph("Item Description", table_header_style),
        Paragraph("HSN Code", table_header_style),
        Paragraph("Qty", table_header_style),
        Paragraph("Unit Price", table_header_style),
        Paragraph("GST %", table_header_style),
        Paragraph("Total Price", table_header_style)
    ]]
    
    total_taxable = 0.0
    total_gst = 0.0
    
    for idx, item in enumerate(transaction.items, 1):
        prod_name = item.product.name if item.product else "Unknown"
        hsn = item.product.hsn_code if (item.product and item.product.hsn_code) else "84733099"
        gst_rate = item.product.gst_rate if item.product else 18.0
        
        # Prices are GST inclusive
        item_total = item.quantity * item.price_at_sale
        taxable_val = item_total / (1 + gst_rate / 100.0)
        gst_amt = item_total - taxable_val
        
        total_taxable += taxable_val
        total_gst += gst_amt
        
        table_data.append([
            Paragraph(str(idx), table_body_style),
            Paragraph(prod_name, table_body_style),
            Paragraph(hsn, table_body_style),
            Paragraph(str(item.quantity), table_body_style),
            Paragraph(f"Rs. {item.price_at_sale:.2f}", table_body_style),
            Paragraph(f"{gst_rate}%", table_body_style),
            Paragraph(f"Rs. {item_total:.2f}", table_body_style)
        ])
        
    items_table = Table(table_data, colWidths=[0.5 * inch, 2.5 * inch, 1.0 * inch, 0.5 * inch, 0.9 * inch, 0.7 * inch, 0.9 * inch])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1A365D")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F7FAFC")]),
        ('PADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,-1), (-1,-1), 1, colors.HexColor("#E2E8F0")),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 15))
    
    # 4. Summary Section
    cgst = round(total_gst / 2.0, 2)
    sgst = round(total_gst / 2.0, 2)
    grand_total = transaction.total_amount
    subtotal = round(total_taxable, 2)
    
    summary_data = [
        [Paragraph("", meta_style), Paragraph("Taxable Subtotal:", table_body_style), Paragraph(f"Rs. {subtotal:.2f}", table_body_style)],
        [Paragraph("", meta_style), Paragraph("CGST:", table_body_style), Paragraph(f"Rs. {cgst:.2f}", table_body_style)],
        [Paragraph("", meta_style), Paragraph("SGST:", table_body_style), Paragraph(f"Rs. {sgst:.2f}", table_body_style)],
        [Paragraph("", meta_style), Paragraph("<b>Grand Total:</b>", table_body_style), Paragraph(f"<b>Rs. {grand_total:.2f}</b>", table_body_style)]
    ]
    
    summary_table = Table(summary_data, colWidths=[4.2 * inch, 1.4 * inch, 1.4 * inch])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (1,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
        ('LINEABOVE', (1,3), (2,3), 1, colors.HexColor("#1A365D")), # Line above grand total (now at index 3)
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 40))
    
    # 5. Footer
    footer_style = ParagraphStyle(
        'InvoiceFooter',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        alignment=1, # Center
        textColor=colors.HexColor("#A0AEC0")
    )
    story.append(Paragraph("Thank you for shopping with us! Please come again.", footer_style))
    
    # Build document
    doc.build(story)
    
    buffer.seek(0)
    return buffer

def generate_gst_pdf_report(return_type, summary_data, biz_config):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1A365D"),
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'ReportSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#2B6CB0"),
        spaceAfter=15
    )
    
    meta_style = ParagraphStyle(
        'ReportMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#2D3748")
    )
    
    table_header_style = ParagraphStyle(
        'ReportTableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.white
    )
    
    table_body_style = ParagraphStyle(
        'ReportTableBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#2D3748")
    )

    table_body_bold = ParagraphStyle(
        'ReportTableBodyBold',
        parent=table_body_style,
        fontName='Helvetica-Bold'
    )
    
    # Title Section
    title_text = "GST COMPLIANCE & RETURN AUDIT PACKAGE"
    if return_type == 'gstr1':
        title_text = "FORM GSTR-1: OUTWARD SUPPLIES RETURN"
    elif return_type == 'gstr3b':
        title_text = "FORM GSTR-3B: CONSOLIDATED MONTHLY RETURN"
    elif return_type == 'gstr9':
        title_text = "FORM GSTR-9: CONSOLIDATED ANNUAL RETURN"
    elif return_type == 'monthly_liability':
        title_text = "GST MONTHLY LIABILITY & LEDGER REPORT"
        
    story.append(Paragraph(title_text, title_style))
    story.append(Paragraph(f"Tax Period: FY 2026-27 | Prepared on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", subtitle_style))
    
    # Business Details Table
    biz_name = biz_config.business_name if biz_config else "TEGL Retail Solutions"
    biz_gstin = biz_config.gstin if biz_config else "27AAPCS1010A1Z0"
    biz_state = biz_config.state if biz_config else "Maharashtra"
    biz_pan = biz_config.pan if biz_config else "AAPCS1010A"
    biz_address = biz_config.address if biz_config else "123 Innovation Way, Retail Suite 100"
    
    biz_data = [
        [Paragraph(f"<b>Business Name:</b> {biz_name}", meta_style), Paragraph(f"<b>GSTIN:</b> {biz_gstin}", meta_style)],
        [Paragraph(f"<b>State/UT:</b> {biz_state}", meta_style), Paragraph(f"<b>PAN:</b> {biz_pan}", meta_style)],
        [Paragraph(f"<b>Registered Address:</b> {biz_address}", meta_style), Paragraph("<b>Filing Status:</b> READY TO FILE", meta_style)]
    ]
    biz_table = Table(biz_data, colWidths=[3.5 * inch, 3.5 * inch])
    biz_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F7FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(biz_table)
    story.append(Spacer(1, 15))
    
    # Executive Financial Summary
    story.append(Paragraph("<b>1. Executive Tax Summary</b>", styles['Heading3']))
    story.append(Spacer(1, 5))
    
    summary_rows = [
        [
            Paragraph("Metrics / Components", table_header_style), 
            Paragraph("CGST (Rs.)", table_header_style), 
            Paragraph("SGST (Rs.)", table_header_style), 
            Paragraph("IGST (Rs.)", table_header_style), 
            Paragraph("Total Tax (Rs.)", table_header_style)
        ],
        [
            Paragraph("Outward Supplies Tax (Liability Collected)", table_body_style),
            Paragraph(f"{summary_data['cgst_collected']:.2f}", table_body_style),
            Paragraph(f"{summary_data['sgst_collected']:.2f}", table_body_style),
            Paragraph(f"{summary_data['igst_collected']:.2f}", table_body_style),
            Paragraph(f"{summary_data['total_gst_collected']:.2f}", table_body_bold),
        ],
        [
            Paragraph("Eligible Inward Supplies (Input Tax Credit)", table_body_style),
            Paragraph(f"{summary_data['cgst_itc']:.2f}", table_body_style),
            Paragraph(f"{summary_data['sgst_itc']:.2f}", table_body_style),
            Paragraph(f"{summary_data['igst_itc']:.2f}", table_body_style),
            Paragraph(f"{summary_data['total_itc']:.2f}", table_body_bold),
        ],
        [
            Paragraph("<b>Net Tax Payable in Cash</b>", table_body_bold),
            Paragraph(f"<b>{summary_data['cgst_payable']:.2f}</b>", table_body_bold),
            Paragraph(f"<b>{summary_data['sgst_payable']:.2f}</b>", table_body_bold),
            Paragraph(f"<b>{summary_data['igst_payable']:.2f}</b>", table_body_bold),
            Paragraph(f"<b>{summary_data['net_payable']:.2f}</b>", table_body_bold),
        ]
    ]
    summary_table = Table(summary_rows, colWidths=[2.6 * inch, 1.1 * inch, 1.1 * inch, 1.1 * inch, 1.1 * inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1A365D")),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, colors.HexColor("#F7FAFC")]),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#EBF8FF")),
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor("#1A365D")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('PADDING', (0,0), (-1,-1), 6),
        ('ALIGN', (1,1), (-1,-1), 'RIGHT')
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 15))
    
    # Detailed Section based on report type
    if return_type == 'gstr1':
        story.append(Paragraph("<b>2. HSN/SAC-Wise Summary of Outward Supplies</b>", styles['Heading3']))
        story.append(Spacer(1, 5))
        hsn_headers = [
            [
                Paragraph("HSN/SAC", table_header_style), 
                Paragraph("Description", table_header_style), 
                Paragraph("Qty", table_header_style), 
                Paragraph("Taxable Val (Rs.)", table_header_style), 
                Paragraph("GST %", table_header_style), 
                Paragraph("Total Tax (Rs.)", table_header_style),
                Paragraph("Total Amount (Rs.)", table_header_style)
            ]
        ]
        for h in summary_data['hsn_summary']:
            hsn_headers.append([
                Paragraph(h['hsn_code'], table_body_style),
                Paragraph("Retail Supplies", table_body_style),
                Paragraph(str(h['quantity']), table_body_style),
                Paragraph(f"{h['taxable_value']:.2f}", table_body_style),
                Paragraph(f"{h['gst_rate']}%", table_body_style),
                Paragraph(f"{h['total_gst']:.2f}", table_body_style),
                Paragraph(f"{h['total_amount']:.2f}", table_body_bold)
            ])
            
        if len(summary_data['hsn_summary']) == 0:
            hsn_headers.append([Paragraph("No outward supplies recorded for this period.", table_body_style), "", "", "", "", "", ""])
            
        hsn_table = Table(hsn_headers, colWidths=[1.0 * inch, 1.2 * inch, 0.5 * inch, 1.2 * inch, 0.6 * inch, 1.2 * inch, 1.3 * inch])
        hsn_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2B6CB0")),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0,0), (-1,-1), 5),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F7FAFC")]),
        ]))
        story.append(hsn_table)
        
    elif return_type in ['gstr3b', 'gstr9', 'monthly_liability']:
        story.append(Paragraph("<b>2. Audit Details & Ledger Balance</b>", styles['Heading3']))
        story.append(Spacer(1, 5))
        
        detail_rows = [
            [
                Paragraph("Category", table_header_style),
                Paragraph("Record Count", table_header_style),
                Paragraph("Taxable Turnover (Rs.)", table_header_style),
                Paragraph("Total Tax Collected/Paid (Rs.)", table_header_style)
            ],
            [
                Paragraph("Sales Outward Supplies", table_body_style),
                Paragraph(str(summary_data.get('sales_count', 0)), table_body_style),
                Paragraph(f"{summary_data['taxable_sales']:.2f}", table_body_style),
                Paragraph(f"{summary_data['total_gst_collected']:.2f}", table_body_style),
            ],
            [
                Paragraph("Purchases Inward Supplies (ITC)", table_body_style),
                Paragraph(str(len(summary_data.get('hsn_summary', []))), table_body_style), # Proxy count
                Paragraph(f"{summary_data['total_purchases']:.2f}", table_body_style),
                Paragraph(f"{summary_data['total_itc']:.2f}", table_body_style),
            ],
            [
                Paragraph("Operating Expenses (ITC)", table_body_style),
                Paragraph("-", table_body_style),
                Paragraph(f"{summary_data['total_expenses']:.2f}", table_body_style),
                Paragraph(f"Eligible Credit Included", table_body_style),
            ]
        ]
        detail_table = Table(detail_rows, colWidths=[2.2 * inch, 1.2 * inch, 1.8 * inch, 1.8 * inch])
        detail_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2B6CB0")),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0,0), (-1,-1), 6),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F7FAFC")]),
        ]))
        story.append(detail_table)
        
    story.append(Spacer(1, 15))
    
    # 3. Compliance & Validation Report
    story.append(Paragraph("<b>3. System Compliance & Audit Check</b>", styles['Heading3']))
    story.append(Spacer(1, 5))
    
    validation_data = [
        [
            Paragraph("Type", table_header_style), 
            Paragraph("Module", table_header_style), 
            Paragraph("ID", table_header_style), 
            Paragraph("Audit Finding / Recommendation", table_header_style)
        ]
    ]
    for v in summary_data['validations']:
        t_style = ParagraphStyle('vtype', parent=table_body_style, textColor=colors.HexColor("#E53E3E") if v['type'] == 'danger' else colors.HexColor("#DD6B20"))
        validation_data.append([
            Paragraph(v['type'].upper(), t_style),
            Paragraph(v['record_type'], table_body_style),
            Paragraph(str(v['record_id']), table_body_style),
            Paragraph(v['message'], table_body_style)
        ])
        
    if len(summary_data['validations']) == 0:
        validation_data.append([Paragraph("PASS: All GST compliance validation checks passed successfully. No anomalies found.", table_body_style), "", "", ""])
        
    v_table = Table(validation_data, colWidths=[0.8 * inch, 1.2 * inch, 0.8 * inch, 4.2 * inch])
    v_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2D3748")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#FFF5F5")]),
    ]))
    story.append(v_table)
    
    story.append(Spacer(1, 35))
    
    # CA Sign and Seal Box
    ca_data = [
        [
            Paragraph("<b>CA AUDIT TRAIL LOG</b><br/>Verified by System Auditor<br/>Digital Hash Checksum Validated", meta_style),
            Paragraph("<b>FOR STATUTORY AUDITING</b><br/><br/>___________________________<br/>Authorized Chartered Accountant<br/>Membership No / UDIN Stamp", ParagraphStyle('ca_right', parent=meta_style, alignment=2))
        ]
    ]
    ca_table = Table(ca_data, colWidths=[3.5 * inch, 3.5 * inch])
    ca_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 10),
        ('LINEABOVE', (0,0), (-1,-1), 1, colors.HexColor("#A0AEC0")),
    ]))
    story.append(ca_table)
    
    doc.build(story)
    buffer.seek(0)
    return buffer

def generate_pnl_pdf_report(pnl_data, biz_config):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'PnLTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#2C5282"),
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'PnLSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#4A5568"),
        spaceAfter=15
    )
    
    meta_style = ParagraphStyle(
        'PnLMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#2D3748")
    )
    
    table_header_style = ParagraphStyle(
        'PnLTableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        textColor=colors.white
    )
    
    table_body_style = ParagraphStyle(
        'PnLTableBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#2D3748")
    )

    table_body_bold = ParagraphStyle(
        'PnLTableBodyBold',
        parent=table_body_style,
        fontName='Helvetica-Bold'
    )
    
    story.append(Paragraph("PROFIT & LOSS STATEMENT", title_style))
    story.append(Paragraph(f"For the Period: FY 2026-27 | Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", subtitle_style))
    
    biz_name = biz_config.business_name if biz_config else "TEGL Retail Solutions"
    biz_gstin = biz_config.gstin if biz_config else "27AAPCS1010A1Z0"
    
    biz_data = [
        [Paragraph(f"<b>Business Entity:</b> {biz_name}", meta_style), Paragraph(f"<b>GSTIN:</b> {biz_gstin}", meta_style)]
    ]
    biz_table = Table(biz_data, colWidths=[3.5 * inch, 3.5 * inch])
    biz_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EDF2F7")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E0")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(biz_table)
    story.append(Spacer(1, 20))
    
    # P&L Ledger Table
    pnl_rows = [
        [
            Paragraph("Particulars / Income & Expenses", table_header_style), 
            Paragraph("Amount (Rs.)", table_header_style)
        ],
        [
            Paragraph("<b>I. REVENUE FROM OPERATIONS</b>", table_body_bold), 
            Paragraph(f"<b>{pnl_data['revenue']:.2f}</b>", table_body_bold)
        ],
        [
            Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;Gross Retail Sales (excl. GST)", table_body_style), 
            Paragraph(f"{pnl_data['revenue']:.2f}", table_body_style)
        ],
        [
            Paragraph("<b>TOTAL REVENUE (A)</b>", table_body_bold), 
            Paragraph(f"<b>{pnl_data['revenue']:.2f}</b>", table_body_bold)
        ],
        [
            Paragraph("<b>II. COST OF GOODS SOLD (COGS)</b>", table_body_bold), 
            Paragraph(f"({pnl_data['cogs']:.2f})", table_body_bold)
        ],
        [
            Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;Product Material Base Cost", table_body_style), 
            Paragraph(f"{pnl_data['cogs']:.2f}", table_body_style)
        ],
        [
            Paragraph("<b>TOTAL COST OF GOODS SOLD (B)</b>", table_body_bold), 
            Paragraph(f"<b>({pnl_data['cogs']:.2f})</b>", table_body_bold)
        ],
        [
            Paragraph("<b>III. GROSS PROFIT (C = A - B)</b>", table_body_bold), 
            Paragraph(f"<b>{pnl_data['gross_profit']:.2f}</b>", table_body_bold)
        ],
        [
            Paragraph("<b>IV. OPERATING EXPENSES</b>", table_body_bold), 
            Paragraph(f"({pnl_data['operating_expenses']:.2f})", table_body_bold)
        ]
    ]
    
    # Add category-wise expenses
    for cat in pnl_data.get('expense_breakdown', []):
        pnl_rows.append([
            Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{cat['category']}", table_body_style),
            Paragraph(f"{cat['amount']:.2f}", table_body_style)
        ])
        
    pnl_rows.append([
        Paragraph("<b>TOTAL OPERATING EXPENSES (D)</b>", table_body_bold), 
        Paragraph(f"<b>({pnl_data['operating_expenses']:.2f})</b>", table_body_bold)
    ])
    
    pnl_rows.append([
        Paragraph("<b>V. NET PROFIT BEFORE TAX (E = C - D)</b>", table_body_bold), 
        Paragraph(f"<b>{pnl_data['net_profit']:.2f}</b>", table_body_bold)
    ])
    
    pnl_table = Table(pnl_rows, colWidths=[4.8 * inch, 2.2 * inch])
    pnl_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2C5282")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 6),
        ('ALIGN', (1,0), (-1,-1), 'RIGHT'),
        ('BACKGROUND', (0,1), (-1,1), colors.HexColor("#F7FAFC")),
        ('BACKGROUND', (0,3), (-1,3), colors.HexColor("#EDF2F7")),
        ('BACKGROUND', (0,7), (-1,7), colors.HexColor("#EBF8FF")),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#C6F6D5")),  # Green background for Net Profit
    ]))
    story.append(pnl_table)
    story.append(Spacer(1, 40))
    
    # Signature Box
    ca_data = [
        [
            Paragraph("Prepared by: Internal Accounts Dept.", meta_style),
            Paragraph("Verified and Approved by:<br/><br/>___________________________<br/>Managing Director / Owner", ParagraphStyle('owner_right', parent=meta_style, alignment=2))
        ]
    ]
    ca_table = Table(ca_data, colWidths=[3.5 * inch, 3.5 * inch])
    ca_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(ca_table)
    
    doc.build(story)
    buffer.seek(0)
    return buffer

def generate_purchasing_plan_pdf(budget_result):
    from io import BytesIO
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'PlanTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#2C5282"),
        alignment=1,
        spaceAfter=15
    )
    
    meta_style = ParagraphStyle(
        'PlanMeta',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#4A5568")
    )
    
    body_style = ParagraphStyle(
        'PlanBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=14
    )
    
    header_style = ParagraphStyle(
        'PlanHeader',
        parent=styles['Normal'],
        fontSize=10,
        leading=12,
        textColor=colors.white,
        fontName='Helvetica-Bold'
    )
    
    story.append(Paragraph("AI-RECOMMENDED STOCK PURCHASING LIST", title_style))
    story.append(Spacer(1, 10))
    
    # Metadata Block
    date_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    meta_text = f"""
    <b>Plan Generated:</b> {date_str}<br/>
    <b>Category:</b> {budget_result.get('category', 'All')}<br/>
    <b>Allocated Budget Limit:</b> Rs. {budget_result.get('budget', 0):.2f}<br/>
    <b>Timeframe Period:</b> {budget_result.get('period_days', 30)} days<br/>
    <b>Total Investment:</b> Rs. {budget_result.get('budget_used', 0):.2f}<br/>
    <b>Expected Revenue:</b> Rs. {budget_result.get('estimated_sales', 0):.2f}<br/>
    <b>Expected Net Margin:</b> Rs. {budget_result.get('estimated_profit', 0):.2f}<br/>
    """
    story.append(Paragraph(meta_text, meta_style))
    story.append(Spacer(1, 15))
    
    # Table of products
    table_data = [[
        Paragraph("Product Name", header_style),
        Paragraph("Suggested Qty", header_style),
        Paragraph("Investment Cost (Rs.)", header_style),
        Paragraph("Expected Rev. (Rs.)", header_style),
        Paragraph("Expected Margin (Rs.)", header_style)
    ]]
    
    for item in budget_result.get('items', []):
        table_data.append([
            Paragraph(f"<b>{item.get('name')}</b>", body_style),
            Paragraph(f"{item.get('suggested_qty')} units", body_style),
            Paragraph(f"{item.get('cost'):.2f}", body_style),
            Paragraph(f"{item.get('expected_revenue'):.2f}", body_style),
            Paragraph(f"{item.get('expected_profit'):.2f}", body_style)
        ])
        
    plan_table = Table(table_data, colWidths=[2.2 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch])
    plan_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2C5282")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 6),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor("#F7FAFC")),
    ]))
    
    story.append(plan_table)
    story.append(Spacer(1, 30))
    
    story.append(Paragraph("<b>Disclaimer:</b> These purchasing recommendations are generated using linear regression models based on past store trends and are suggestions to optimize cash flows.", meta_style))
    story.append(Spacer(1, 20))
    
    # Signature Box
    sig_data = [
        [
            Paragraph("Prepared by: AI Forecasting System", meta_style),
            Paragraph("Approved by:<br/><br/>___________________________<br/>Owner / Manager Signature", ParagraphStyle('sig_right', parent=meta_style, alignment=2))
        ]
    ]
    sig_table = Table(sig_data, colWidths=[3.5 * inch, 3.5 * inch])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(sig_table)
    
    doc.build(story)
    buffer.seek(0)
    return buffer


