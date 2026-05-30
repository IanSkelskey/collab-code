from rich.console import Console
from rich.table import Table


def main():
    console = Console()
    table = Table(title="Collab Code Python Starter")
    table.add_column("File")
    table.add_column("Purpose")
    table.add_row("main.py", "Runs the starter script")
    table.add_row("requirements.txt", "Lists packages to install before each run")

    console.print(table)
    console.print("\nUpdate requirements.txt to add more packages for this room.")


if __name__ == "__main__":
    main()
