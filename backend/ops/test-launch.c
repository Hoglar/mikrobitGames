/* Narrow local test launcher. Install root-owned, setuid, executable only by
 * the developer's private test group. Never interprets Python/shell as root.
 * All identities, paths, executables and arguments except port/mode are fixed.
 */
#define _GNU_SOURCE
#include <errno.h>
#include <grp.h>
#include <linux/capability.h>
#include <pwd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>

#ifndef MBG_REPO
#error MBG_REPO must name the reviewed checkout
#endif
#ifndef MBG_CALLER
#error MBG_CALLER must name the authorized local user
#endif

static void fail(const char *message) { fprintf(stderr, "mbg-test-launch: %s\n", message); exit(2); }
static void preserve(const char *name) {
    const char *value = getenv(name);
    if (value && strlen(value) > 65536) fail("environment too large");
}

int main(int argc, char **argv) {
    struct passwd *caller = getpwnam(MBG_CALLER);
    if (!caller || getuid() != caller->pw_uid || geteuid() != 0) fail("unauthorized caller");
    char *caller_home = strdup(caller->pw_dir);
    if (!caller_home) fail("out of memory");
    if (argc < 2) fail("mode required");
    const int checking = !strcmp(argv[1], "check");
    const int api = !strcmp(argv[1], "api");
    const int ai = !strcmp(argv[1], "ai");
    const int model = !strcmp(argv[1], "ollama");
    if (!checking && !api && !ai && !model) fail("unknown mode");
    if ((api || ai) && argc != 3) fail("one port required");
    if (model && argc != 2) fail("no model arguments permitted");
    if (checking && argc > 3) fail("one check mode permitted");
    const char *check_mode = argc == 3 ? argv[2] : "full";
    if (checking && strcmp(check_mode,"full") && strcmp(check_mode,"quick") && strcmp(check_mode,"selftest") && strcmp(check_mode,"report") && strcmp(check_mode,"startup")) fail("unsupported check mode");
    if (api || ai) {
        char *end;
        long port = strtol(argv[2], &end, 10);
        if (!*argv[2] || *end || port < 1024 || port > 65535) fail("invalid loopback port");
    }
    /* Only the service's own DSN is inherited; Ollama gets no MBG variable. */
    const char *service_keys[] = {"MBG_DATABASE_DSN","MBG_PUBLIC_ORIGIN","MBG_AI_URL","MBG_OLLAMA_URL","MBG_MODEL","MBG_TEST_METRICS",NULL};
    const char *model_keys[] = {"OLLAMA_HOST","OLLAMA_MODELS","OLLAMA_NO_CLOUD","OLLAMA_NOPRUNE",NULL};
    const char **keys = model ? model_keys : service_keys;
    char *values[8] = {0};
    if (!checking) {
        for (int i=0; keys[i]; ++i) { preserve(keys[i]); if (getenv(keys[i])) values[i]=strdup(getenv(keys[i])); }
    }
    if (clearenv()) fail("cannot clear environment");
    setenv("PATH","/usr/local/bin:/usr/bin:/bin",1);
    setenv("LANG","C.UTF-8",1);
    setenv("PYTHONDONTWRITEBYTECODE","1",1);
    if (!checking) for (int i=0; keys[i]; ++i) if (values[i]) setenv(keys[i],values[i],1);
    struct passwd *target = getpwnam(checking ? MBG_CALLER : api ? "mbg-test-api" : ai ? "mbg-test-ai" : "mbg-test-model");
    if (!target || target->pw_uid == 0) fail("test identity missing");
    uid_t uid = target->pw_uid;
    gid_t gid = target->pw_gid;
    setenv("HOME",checking ? caller_home : target->pw_dir,1);
    struct group *launch_group = getgrnam("mbg-test-launch");
    if (checking && !launch_group) fail("launch group missing");
    gid_t launch_gid = checking ? launch_group->gr_gid : 0;
    if (setgroups(checking ? 1 : 0, checking ? &launch_gid : NULL)) fail("cannot clear groups");
    if (checking && prctl(PR_SET_KEEPCAPS,1L)) fail("cannot retain measurement capabilities");
    if (setresgid(gid,gid,gid) || setresuid(uid,uid,uid)) fail("cannot drop root");
    struct __user_cap_header_struct header = {_LINUX_CAPABILITY_VERSION_3,0};
    struct __user_cap_data_struct caps[2] = {{0}};
    if (checking) {
        unsigned mask = (1U << CAP_SYS_PTRACE) | (1U << CAP_KILL);
        caps[0].permitted = caps[0].effective = caps[0].inheritable = mask;
    }
    if (syscall(SYS_capset,&header,caps)) fail("cannot set capabilities");
    if (checking) {
        if (prctl(PR_CAP_AMBIENT,PR_CAP_AMBIENT_RAISE,CAP_SYS_PTRACE,0,0) ||
            prctl(PR_CAP_AMBIENT,PR_CAP_AMBIENT_RAISE,CAP_KILL,0,0)) fail("cannot enable measurement capabilities");
        setenv("MBG_ISOLATED_RUNNER","1",1);
    } else if (prctl(PR_SET_NO_NEW_PRIVS,1L,0L,0L,0L)) fail("cannot restrict privilege changes");
    if (chdir(MBG_REPO)) fail("checkout inaccessible");
    if (checking) {
        /* CPython uses argv[0] to discover pyvenv.cfg. A bare "python" here
         * selects /usr through PATH even though exec opens the venv binary. */
        execl(MBG_REPO "/.venv/bin/python", MBG_REPO "/.venv/bin/python", MBG_REPO "/backend/ops/test-runner.py", check_mode, (char*)NULL);
    } else if (model) {
        setenv("OLLAMA_NO_CLOUD","1",1);
        execl("/usr/local/bin/ollama","ollama","serve",(char*)NULL);
    } else {
        execl(MBG_REPO "/.venv/bin/python",MBG_REPO "/.venv/bin/python","-m","uvicorn",api ? "http_api:app" : "transport:app",
            "--app-dir",api ? MBG_REPO "/backend/api/src" : MBG_REPO "/backend/ai-service/src",
            "--host","127.0.0.1","--port",argv[2],"--no-proxy-headers","--no-access-log",(char*)NULL);
    }
    fail("exec failed");
}
