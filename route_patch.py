import re

with open("src/App.tsx", "r") as f:
    content = f.read()

# Add imports
imports = """import JarvisBaseView from './views/JarvisBaseView';
import AcademicRegistryView from './views/AcademicRegistryView';
import ClassGroupDetailsView from './views/ClassGroupDetailsView';
"""
content = re.sub(r"import JarvisBaseView from './views/JarvisBaseView';", imports, content)

# Add routes inside <Route path="/" element={<JarvisBaseView />}>
routes = """          <Route path="academic" element={<AcademicRegistryView />} />
          <Route path="academic/class/:id" element={<ClassGroupDetailsView />} />
"""
content = re.sub(r'(<Route path="/" element={<JarvisBaseView />}>)', r'\1\n' + routes, content)

with open("src/App.tsx", "w") as f:
    f.write(content)

# Update sidebar in JarvisBaseView.tsx
with open("src/views/JarvisBaseView.tsx", "r") as f:
    content = f.read()

sidebar_link = """          <Link to="/academic" className="flex items-center space-x-3 text-slate-300 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition-colors">
            <BookOpen className="w-5 h-5" />
            <span>Cadastro Acadêmico</span>
          </Link>"""

content = re.sub(r'(<Link to="/" className="flex items-center space-x-3 text-slate-300 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition-colors">)', sidebar_link + r'\n          \1', content)

with open("src/views/JarvisBaseView.tsx", "w") as f:
    f.write(content)
