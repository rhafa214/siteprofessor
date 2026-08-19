import re

# App.tsx
with open("src/App.tsx", "r") as f:
    content = f.read()

content = content.replace("import AcademicRegistryView from './views/AcademicRegistryView';\n", "")
content = content.replace("import ClassGroupDetailsView from './views/ClassGroupDetailsView';\n", "")
content = re.sub(r'<Route path="academic"[^\n]+\n', '', content)
content = re.sub(r'<Route path="academic/class/:id"[^\n]+\n', '', content)

with open("src/App.tsx", "w") as f:
    f.write(content)

# JarvisBaseView.tsx
with open("src/views/JarvisBaseView.tsx", "r") as f:
    content = f.read()

content = re.sub(r'<Link to="/academic"[^>]+>\s*<BookOpen[^>]+>\s*<span>Cadastro Acadêmico</span>\s*</Link>\n\s*', '', content)

with open("src/views/JarvisBaseView.tsx", "w") as f:
    f.write(content)

