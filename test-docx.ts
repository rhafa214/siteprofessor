import * as docx from "docx";
import * as fs from "fs";

const table = new docx.Table({
    width: { size: 9360, type: docx.WidthType.DXA },
    rows: [
        new docx.TableRow({
            children: [
                new docx.TableCell({
                    width: { size: 7360, type: docx.WidthType.DXA },
                    children: [new docx.Paragraph("A")]
                }),
                new docx.TableCell({
                    width: { size: 2000, type: docx.WidthType.DXA },
                    children: [new docx.Paragraph("B")]
                })
            ]
        })
    ]
});

const doc = new docx.Document({ sections: [{ children: [table] }] });

docx.Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync("test.docx", buffer);
    console.log("Success");
}).catch(err => {
    console.error(err);
});
