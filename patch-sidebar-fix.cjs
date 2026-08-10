const fs = require('fs');
let code = fs.readFileSync('src/views/AddonSidebar.tsx', 'utf8');

const regex = /if \(file\.name\.endsWith\("\.pdf"\)\) \{[\s\S]*?\} finally \{/;

const newBranch = `if (file.name.endsWith(".pdf")) {
      setIsExtractingPDF(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await authenticatedFetch("/api/parse-addon-curriculum", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          let errMsg = "Falha ao processar o PDF.";
          try {
            const errData = await res.json();
            errMsg = errData.error || errMsg;
          } catch (e) {}
          throw new Error(errMsg);
        }

        const parsed = await res.json();
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomAulas((prev) => [...prev, ...parsed]);
          alert(\`Escopo PDF importado com sucesso! \${parsed.length} aulas extraídas.\`);
        } else {
          alert(\`O PDF foi processado, mas o formato não continha aulas válidas.\`);
        }
      } catch (err: any) {
        console.error(err);
        alert("Erro no processamento do PDF: " + (err.message || "Erro desconhecido"));
      } finally {`;

code = code.replace(regex, newBranch);
fs.writeFileSync('src/views/AddonSidebar.tsx', code);
