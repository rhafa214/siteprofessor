import * as docx from "docx";
import * as fs from "fs";

const table = new docx.Table({
    width: { size: 5000, type: docx.WidthType.PERCENTAGE },
    rows: [
        new docx.TableRow({
            children: [
                new docx.TableCell({
                    width: { size: 4000, type: docx.WidthType.PERCENTAGE },
                    children: [new docx.Paragraph("A")]
                }),
                new docx.TableCell({
                    width: { size: 1000, type: docx.WidthType.PERCENTAGE },
                    children: [new docx.Paragraph("B")]
                })
            ]
        })
    ]
});

const doc = new docx.Document({ sections: [{ children: [table] }] });

docx.Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync("test.docx", buffer);
    console.log("Success percent");
}).catch(err => {
    console.error(err);
});
