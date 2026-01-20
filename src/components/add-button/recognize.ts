// Web Speech API 类型定义
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionError extends Event {
    error: string;
    message: string;
}

interface ISpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionError) => void) | null;
    onend: (() => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition: new () => ISpeechRecognition;
        webkitSpeechRecognition: new () => ISpeechRecognition;
    }
}

let currentRecognition: ISpeechRecognition | null = null;

export function isSpeechRecognitionSupported() {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
    return !!SpeechRecognition;
}

export function startRecognize(onChange?: (text: string) => void) {
    console.log("start recognize");

    // 检查浏览器是否支持 Web Speech API
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        const error = new Error("unsupported browser");
        return {
            finished: Promise.reject(error),
            cancel: () => {},
            stop: () => {},
        };
    }

    // 停止之前的识别
    if (currentRecognition) {
        currentRecognition.abort();
        currentRecognition = null;
    }

    const recognition = new SpeechRecognition();
    currentRecognition = recognition;

    // 配置识别参数
    recognition.continuous = true; // 持续识别
    recognition.interimResults = true; // 返回中间结果
    recognition.lang = "zh-CN"; // 设置语言为中文
    recognition.maxAlternatives = 1; // 最多返回一个识别结果

    let finalTranscript = "";
    let currentText = ""; // 保存当前完整文本（包括临时结果）
    let isCancelled = false;
    let isStopped = false; // 标记是否手动停止
    let promiseResolve: (value: string) => void;
    let promiseReject: (reason: Error) => void;

    const finished = new Promise<string>((resolve, reject) => {
        promiseResolve = resolve;
        promiseReject = reject;

        // 处理识别结果
        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interimTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript;

                if (result.isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // 保存当前完整文本（包括最终和临时结果）
            currentText = finalTranscript + interimTranscript;

            // 调用 onChange 回调，传递当前识别到的文本（包括最终和临时结果）
            if (onChange && currentText) {
                onChange(currentText);
            }
        };

        // 处理错误
        recognition.onerror = (event: SpeechRecognitionError) => {
            console.error("Recognition error:", event.error, event.message);

            // 手动取消的情况在 cancel 方法中处理
            if (event.error === "aborted" && isCancelled) {
                return;
            }

            // 其他错误情况
            if (event.error !== "aborted") {
                const errorMessage = event.error;
                reject(new Error(errorMessage));
            }

            currentRecognition = null;
        };

        // 识别结束
        recognition.onend = () => {
            console.log("Recognition ended");

            // 如果是取消操作，不执行 resolve
            if (isCancelled) {
                currentRecognition = null;
                return;
            }

            // 如果是手动停止，返回当前完整文本（包括临时结果）
            // 否则返回最终文本
            const resultText = isStopped ? currentText : finalTranscript;
            promiseResolve(resultText);
            currentRecognition = null;
        };

        // 开始识别
        try {
            recognition.start();
        } catch (error) {
            console.error("Failed to start recognition:", error);
            const err =
                error instanceof Error ? error : new Error(String(error));
            reject(err);
            currentRecognition = null;
        }
    });

    return {
        finished,
        // 取消识别 - 让 finished Promise reject
        cancel: () => {
            console.log("cancel recognize");
            if (recognition && currentRecognition === recognition) {
                isCancelled = true;
                promiseReject(new Error("aborted manually"));
                recognition.abort();
                currentRecognition = null;
            }
        },
        // 停止识别 - 让 finished Promise resolve
        stop: () => {
            console.log("stop recognize");
            if (recognition && currentRecognition === recognition) {
                isStopped = true; // 标记为手动停止
                recognition.stop();
            }
        },
    };
}

export function stopRecognize() {
    console.log("stop recognize");
    if (currentRecognition) {
        currentRecognition.stop();
        currentRecognition = null;
    }
}
