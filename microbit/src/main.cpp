#include "MicroBit.h"
#include "app.h"

codal::MicroBit device;
mikrobit::Application* application = NULL;

int main() {
    device.init();
    application = new mikrobit::Application(device);
    if (!application->initialize()) microbit_panic(42);
    application->run();
    release_fiber();
    return 0;
}
