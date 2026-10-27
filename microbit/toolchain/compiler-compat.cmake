# The pinned upstream uses <DEPFILE>, which modern CMake emits literally.
# Use CMake's supported placeholders so Ninja/Make track header dependencies.
set(CMAKE_DEPFILE_FLAGS_C "-MMD -MT <DEP_TARGET> -MF <DEP_FILE>")
set(CMAKE_DEPFILE_FLAGS_CXX "-MMD -MT <DEP_TARGET> -MF <DEP_FILE>")
