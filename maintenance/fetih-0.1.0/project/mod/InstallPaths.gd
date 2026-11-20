extends RefCounted

static func bridge_directory() -> String:
	if OS.has_feature("editor"):
		return ProjectSettings.globalize_path("res://../payload/bridge").simplify_path()
	return OS.get_executable_path().get_base_dir().path_join("bridge")

