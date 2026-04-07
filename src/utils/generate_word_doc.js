const {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
  TextRun,
  ExternalHyperlink,
  AlignmentType,
  HeadingLevel,
} = require("docx");
const fs = require("fs");

async function createWordDoc(jsonData, outputPath) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "NCAA Baseball Camps 2026 (Division I & II)",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Generated on: ${new Date().toLocaleDateString()}`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }), // Spacer
          new Table({
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            rows: [
              new TableRow({
                children: [
                  "University",
                  "Div",
                  "Camp URL",
                  "Dates",
                  "Cost",
                  "Coach",
                  "Camp POC",
                  "Email",
                ].map(
                  (header) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: header, bold: true })],
                        }),
                      ],
                      shading: { fill: "F0F0F0" },
                    }),
                ),
              }),
              ...jsonData
                .sort((a, b) => a.university.localeCompare(b.university))
                .map(
                  (item) =>
                    new TableRow({
                      children: [
                        new TableCell({
                          children: [new Paragraph(item.university || "")],
                        }),
                        new TableCell({
                          children: [new Paragraph(item.division || "DI")],
                        }),
                        new TableCell({
                          children: [
                            item.campUrl
                              ? new Paragraph({
                                  children: [
                                    new ExternalHyperlink({
                                      children: [
                                        new TextRun({
                                          text: "Link",
                                          style: "Hyperlink",
                                          color: "0000FF",
                                          underline: true,
                                        }),
                                      ],
                                      link: item.campUrl,
                                    }),
                                  ],
                                })
                              : new Paragraph("TBA"),
                          ],
                        }),
                        new TableCell({
                          children: [new Paragraph(item.dates || "TBA")],
                        }),
                        new TableCell({
                          children: [new Paragraph(item.cost || "TBA")],
                        }),
                        new TableCell({
                          children: [
                            new Paragraph(item.headCoach || "Athletics Staff"),
                          ],
                        }),
                        new TableCell({
                          children: [new Paragraph(item.campPOC || "TBA")],
                        }),
                        new TableCell({
                          children: [new Paragraph(item.campPOCEmail || "TBA")],
                        }),
                      ],
                    }),
                ),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            text: "Notes Section:",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph(
            "Prioritized 2026 upcoming sessions (summer/fall prospect, youth skills, instructional). Past events or 2025-only pages noted as TBA.",
          ),
          new Paragraph(
            "Costs: Where available, noted with inclusions (e.g., t-shirt, lunch) if listed on registration pages.",
          ),
          new Paragraph(
            "Accuracy: All entries verified from official sources only. Camp pages evolve quickly — re-visit individual school athletics sites periodically.",
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document created: ${outputPath}`);
}

// Load data from file
const rawData = fs.readFileSync("camps_data.json");
const data = JSON.parse(rawData);
createWordDoc(data, "NCAA-Baseball-Camps-2026.docx");
