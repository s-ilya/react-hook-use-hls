import { interpret, createMachine, assign } from "xstate";
import Hls from "hls.js";
import { useEffect, useState } from "react";

const hlsMachine = createMachine({
  initial: "init",
  context: {},
  states: {
    init: {
      always: {
        cond: (context) => context.hls == null,
        target: "noHlsInstance",
      },
    },
    idle: {
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
          context.hls.on(Hls.Events.MEDIA_ATTACHED, () => callback("attachMediaSuccess"));
          context.hls.on(Hls.Events.ERROR, console.log);

          context.hls.attachMedia(context.video);
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
          target: "cleanUp",
        },
      },
    },
    cleanUp: {
      invoke: {
        src: (context, event) => (callback, onReceive) => {
          context.hls.detachMedia();
          context.hls.destroy();
          callback("hlsDestoySuccess");
        },
      },
      on: {
        hlsDestoySuccess: {
          actions: assign({
            hls: undefined,
            video: undefined,
            source: undefined,
          }),
          target: "idle",
        },
      },
    },
  },
});

const hlsMachineService = interpret(hlsMachine);

hlsMachineService.onTransition((state) => {
  console.log(state.value);
});

hlsMachineService.start();

const setVideo = function (video) {
  hlsMachineService.send({
    type: "setVideo",
    payload: video,
  });
};

const setSource = function (source) {
  hlsMachineService.send({
    type: "setSource",
    payload: source,
  });
};

const destroy = function (source) {
  hlsMachineService.send({
    type: "destroy",
  });
};

export default function () {
  const [step, setStep] = useState(hlsMachineService.state.value);
  useEffect(() => hlsMachineService.onTransition((state) => setStep(state.value)), []);

  return {
    step,
    setVideo,
    setSource,
    destroy,
  };
}
