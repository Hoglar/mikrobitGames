# Included only by the generated upstream bootstrap, after MICROBIT is defined.
# Keep application warnings separate from runtime-library warning policies.
target_compile_options(MICROBIT PRIVATE -Werror)
set_property(TARGET MICROBIT APPEND_STRING PROPERTY LINK_FLAGS
    " -Wl,-Map=${PROJECT_SOURCE_DIR}/build/MICROBIT.map")
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
set_property(TARGET MICROBIT PROPERTY EXPORT_COMPILE_COMMANDS ON)
