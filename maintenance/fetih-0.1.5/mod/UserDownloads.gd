extends RefCounted
## Shared, byte-preserving downloads. The optional directory is for isolated QA only.


static func copy_asset(source: String, filename: String, directory_kind: int, target_directory: String = "") -> Dictionary:
	if directory_kind not in [OS.SYSTEM_DIR_DESKTOP, OS.SYSTEM_DIR_DOWNLOADS]:
		return _failure("İndirme klasörü türü geçersiz.")
	if not filename.is_valid_filename() or filename.ends_with(".") or filename.ends_with(" "):
		return _failure("Dosya adı geçersiz.")
	var stem: String = filename.get_basename()
	var device: String = stem.get_slice(".", 0).to_upper()
	if device in ["CON", "PRN", "AUX", "NUL"] or (device.length() == 4 and device.left(3) in ["COM", "LPT"] and device.right(1) in "123456789"):
		return _failure("Dosya adı geçersiz.")
	var directory: String
	if target_directory.is_empty():
		directory = OS.get_system_dir(directory_kind)
	else:
		var args := OS.get_cmdline_user_args()
		var isolated_test := "--self-test" in args or ("--qa-scene" in args and "--qa-exit" in args)
		if not isolated_test or not target_directory.is_absolute_path() or target_directory.contains("://"):
			return _failure("Özel indirme klasörü yalnızca izole QA için kullanılabilir.")
		if ".." in target_directory.replace("\\", "/").split("/"):
			return _failure("QA klasörü yolu geçersiz.")
		directory = target_directory
	if directory.is_empty() or not DirAccess.dir_exists_absolute(directory):
		return _failure("İndirme klasörüne erişilemiyor.")
	var input: FileAccess = FileAccess.open(source, FileAccess.READ)
	if input == null:
		return _failure("Kaynak dosya okunamadı.")
	var source_size: int = input.get_length()
	input.close()
	var extension: String = filename.get_extension()
	var ending: String = "" if extension.is_empty() else "." + extension
	var suffix: int = 1
	var destination: String = directory.path_join(filename)
	var source_hash: String = ""
	while FileAccess.file_exists(destination) or DirAccess.dir_exists_absolute(destination):
		var existing: FileAccess = FileAccess.open(destination, FileAccess.READ) if FileAccess.file_exists(destination) else null
		if existing != null:
			var same_size: bool = existing.get_length() == source_size
			existing.close()
			if same_size:
				# Hash only on a same-size collision, once per source per request.
				if source_hash.is_empty():
					source_hash = FileAccess.get_sha256(source)
					if source_hash.is_empty():
						return _failure("Kaynak dosya doğrulanamadı.")
				if source_hash == FileAccess.get_sha256(destination):
					return {"ok": true, "path": destination, "error": ""}
		suffix += 1
		destination = directory.path_join("%s (%d)%s" % [stem, suffix, ending])
	var result: Error = DirAccess.copy_absolute(source, destination)
	if result != OK:
		if FileAccess.file_exists(destination):
			DirAccess.remove_absolute(destination)
		return _failure("Dosya indirilemedi: " + error_string(result))
	return {"ok": true, "path": destination, "error": ""}


static func _failure(message: String) -> Dictionary:
	return {"ok": false, "path": "", "error": message}
