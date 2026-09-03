' Lanza run-check.bat sin abrir ventana de consola (para la tarea programada).
Dim fso, shell, here
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run """" & here & "\run-check.bat""", 0, False
