with open("src/components/layout/Sidebar.tsx", "r") as f:
    content = f.read()

content = content.replace("Layers,\n, BookOpen }", "Layers, BookOpen }")
content = content.replace("Layers,\n  , BookOpen", "Layers, BookOpen")

with open("src/components/layout/Sidebar.tsx", "w") as f:
    f.write(content)
