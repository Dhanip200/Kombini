import speech_recognition as sr
import sys
import json

def listen_and_transcribe():
    r = sr.Recognizer()
    result = {"text": "", "error": None}
    
    try:
        # Check if microphones are available
        mics = sr.Microphone.list_microphone_names()
        if not mics:
            result["error"] = "No microphone detected"
            print(json.dumps(result))
            return

        with sr.Microphone() as source:
            # Adjust for ambient noise
            r.adjust_for_ambient_noise(source, duration=0.5)
            # Listen with a timeout to avoid hanging forever
            audio = r.listen(source, timeout=5, phrase_time_limit=10)
        
        # Using Google Web Speech API
        text = r.recognize_google(audio)
        result["text"] = text
            
    except sr.WaitTimeoutError:
        result["error"] = "Listening timed out"
    except sr.UnknownValueError:
        result["error"] = "Could not understand audio"
    except sr.RequestError as e:
        result["error"] = f"Network error: {e}"
    except Exception as e:
        result["error"] = f"System error: {str(e)}"

    # Print JSON result to stdout for the calling process to capture
    print(json.dumps(result))

if __name__ == "__main__":
    listen_and_transcribe()
