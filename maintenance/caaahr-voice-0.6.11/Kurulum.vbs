Option Explicit
Dim shell, files, entry
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
entry = files.BuildPath(files.GetParentFolderName(WScript.ScriptFullName), "Install.ps1")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " & Chr(34) & entry & Chr(34), 1, True
