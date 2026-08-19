with open("src/lib/constants.ts", "r") as f:
    content = f.read()

content = content.replace('| "lousa-magica";', '| "lousa-magica"\n  | "cadastro-academico";')

with open("src/lib/constants.ts", "w") as f:
    f.write(content)
