with open("src/components/layout/WindowManager.tsx", "r") as f:
    content = f.read()

# Import the new view
import_str = "import JarvisBaseView from '../../views/JarvisBaseView';\nimport AcademicRegistryView from '../../views/AcademicRegistryView';\n"
content = content.replace("import JarvisBaseView from '../../views/JarvisBaseView';", import_str)

# Add mapping
mapping_str = """  'jarvis': <JarvisBaseView />,
  'cadastro-academico': <AcademicRegistryView />,"""
content = content.replace("'jarvis': <JarvisBaseView />,", mapping_str)

with open("src/components/layout/WindowManager.tsx", "w") as f:
    f.write(content)
