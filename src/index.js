import { interpret, createMachine, assign } from "xstate";
import Hls from "hls.js";

const hlsMachine = createMachine({
  initial: "idle",
  context: {},
  states: {
    idle: {
      always: {
        cond: (context) => context.hls == null,
        target: "noHlsInstance",
      },
      on: {
        setVideo: {
          actions: assign((context, event) => ({
            video: event.payload,
          })),
          target: "attachMedia",
        },
      },
    },
    noHlsInstance: {
      invoke: {
        src: (context, event) => (callback, onReceive) => {
          callback({ type: "assignHls", payload: new Hls() });
        },
      },
      on: {
        assignHls: {
          actions: assign((context, event) => ({
            hls: event.payload,
          })),
          target: "idle",
        },
      },
    },
    attachMedia: {
      invoke: {
        src: (context, event) => (callback, onReceive) => {
          context.hls.attachMedia(context.video);
          context.hls.on(Hls.Events.MEDIA_ATTACHED, () => callback("attachMediaSuccess"));
        },
      },
      on: {
        attachMediaSuccess: {
          target: "waitingForSource",
        },
      },
    },
    waitingForSource: {
      on: {
        setSource: {
          actions: assign((context, event) => ({
            source: event.payload,
          })),
          target: "parseManifest",
        },
      },
    },
    parseManifest: {
      invoke: {
        src: (context, event) => (callback, onReceive) => {
          context.hls.loadSource(context.source);
          context.hls.on(Hls.Events.MANIFEST_PARSED, () => callback("parseManifestSuccess"));
        },
      },
      on: {
        parseManifestSuccess: {
          target: "ready",
        },
      },
    },
    ready: {
      on: {
        destroy: {
          target: 'cleanUp'
        }
      }
    },
    cleanUp: {
      invoke: {
        src: (context, event) => (callback, onReceive) => {
          context.hls.detachMedia()
          context.hls.destroy()
          callback('hlsDestoySuccess')
        }
      },
      on: {
        hlsDestoySuccess: {
          actions: assign({
            hls: undefined,
            video: undefined,
            source: undefined
          }),
          target: 'idle'
        }
      }
    }
  },
});

const hlsMachineService = interpret(hlsMachine);

hlsMachineService.onTransition((state) => {
  console.log(state.value);
});

hlsMachineService.start();

let video = document.createElement("video");
video.id = "video";
video.controls = true;
document.body.appendChild(video);

window.hlsMachineService = hlsMachineService;

window.setVideo = function () {
  hlsMachineService.send({
    type: "setVideo",
    payload: document.getElementById("video"),
  });
};

window.setSource = function (source) {
  hlsMachineService.send({
    type: "setSource",
    payload: source,
  });
};
