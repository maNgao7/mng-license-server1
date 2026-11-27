"""Build the private color layer from the pinned sparring fragment shader."""
import argparse
import hashlib
from pathlib import Path
import struct
import subprocess
from tempfile import TemporaryDirectory

HERE = Path(__file__).resolve().parent
ORIGINAL_SHA = "4b17cdbf36c8c3f029fffcb16565e5660027535071ad038df8b396d56de418b6"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("original", type=Path, help="Unmodified fragment SPIR-V from the private arena capture")
    parser.add_argument("--spirv-tools", required=True, type=Path, help="RenderDoc plugins/spirv directory")
    parser.add_argument("--headers", required=True, type=Path, help="Khronos Vulkan-Headers include directory")
    parser.add_argument("--zig", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    original = args.original.read_bytes()
    if hashlib.sha256(original).hexdigest() != ORIGINAL_SHA:
        raise ValueError("This shader is not the verified sparring material.")
    with TemporaryDirectory(prefix="hediye-kit-build-") as temp:
        work = Path(temp)
        source = work / "kit.frag"
        module = work / "kit.spv"
        subprocess.run([args.spirv_tools / "spirv-cross.exe", args.original, "--vulkan-semantics",
                        "--output", source], check=True)
        glsl = source.read_text()
        material = "_2691 = _1990(_2688, gl_FrontFacing);"
        if glsl.count(material) != 1 or glsl.count("void main()") != 1:
            raise ValueError("Unexpected material layout in SPIRV-Cross export")
        helper = (HERE / "kit.glsl").read_text(encoding="utf-8")
        glsl = glsl.replace("void main()", helper + "\nvoid main()")
        source.write_text(glsl.replace(material, material + "\n    _2691._m0._m0.rgb=kitColor(_2691._m0._m0.rgb);"))
        subprocess.run([args.spirv_tools / "glslangValidator.exe", "-V", "--target-env", "vulkan1.3",
                        "--source-entrypoint", "main", "-e", "fragment", "-S", "frag",
                        "-o", module, source], check=True)
        words = [f"0x{word:x}u" for word, in struct.iter_unpack("<I", module.read_bytes())]
        rows = [",".join(words[i:i+16]) for i in range(0, len(words), 16)]
        digest = ",".join(map(str, bytes.fromhex(ORIGINAL_SHA)))
        (work / "kit_module.h").write_text(
            f"#define ORIGINAL_BYTES {len(original)}\nstatic const unsigned char originalDigest[32]={{{digest}}};\n"
            + "static const uint32_t kitWords[]={\n" + ",\n".join(rows) + "};\n")
        subprocess.run([args.zig, "cc", "-target", "x86_64-windows-gnu", "-O2", "-shared",
                        f"-I{args.headers}", f"-I{work}", HERE / "corner_colors.c", "-lbcrypt",
                        "-o", args.output], check=True)


if __name__ == "__main__":
    main()
