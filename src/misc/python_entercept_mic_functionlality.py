import os
import queue
import sys
import time
from datetime import datetime
from pydub import AudioSegment
import sounddevice as sd
import soundfile as sf

class ResilientMicRecorder:
    """
    A modular cross-platform audio recorder designed to bypass application-level 
    microphone locks and support dynamic file formats (WAV/MP3). Ideal for CLI tools 
    and AI Agent integration.
    """
    def __init__(self, output_dir="./recordings", sample_rate=44100, channels=1, block_size=1024):
        self.output_dir = output_dir
        self.sample_rate = sample_rate
        self.channels = channels
        self.block_size = block_size
        self.audio_queue = queue.Queue()
        self.is_recording = False
        self.stream = None

    def _audio_callback(self, indata, frames, time_info, status):
        """Internal callback to capture stream blocks safely into the queue."""
        if status:
            print(f"Stream status warning: {status}", file=sys.stderr)
        self.audio_queue.put(indata.copy())

    def _get_resilient_stream(self):
        """Attempts system default streams before cycling through fallback APIs on Windows."""
        try:
            stream = sd.InputStream(samplerate=self.sample_rate, channels=self.channels, 
                                    blocksize=self.block_size, callback=self._audio_callback)
            return stream, "System Default Driver"
        except Exception as e:
            if sys.platform != "win32":
                raise e
            print("\n[Lock Detected] Default driver locked. Trying fallback subsystems...")

        # Windows bypass layer
        fallbacks = ["Windows DirectSound", "MME"]
        devices = sd.query_devices()
        host_apis = sd.query_hostapis()

        for fallback_api_name in fallbacks:
            api_index = next((api['index'] for api in host_apis if fallback_api_name in api['name']), None)
            if api_index is None:
                continue
                
            for idx, dev in enumerate(devices):
                if dev['hostapi'] == api_index and dev['max_input_channels'] > 0:
                    if dev == devices[host_apis[api_index]['default_input_device']]:
                        try:
                            stream = sd.InputStream(device=idx, samplerate=self.sample_rate, 
                                                    channels=self.channels, blocksize=self.block_size, 
                                                    callback=self._audio_callback)
                            return stream, fallback_api_name
                        except Exception:
                            continue
                            
        raise RuntimeError("Microphone is strictly locked or unavailable on all subsystems.")

    def _compress_to_mp3(self, wav_path):
        """Converts raw WAV to MP3 using pydub and drops the source WAV file."""
        mp3_path = wav_path.replace(".wav", ".mp3")
        try:
            audio = AudioSegment.from_wav(wav_path)
            audio.export(mp3_path, format="mp3", bitrate="128k")
            if os.path.exists(wav_path):
                os.remove(wav_path)
            return mp3_path
        except Exception as e:
            print(f"⚠️ MP3 Conversion failed (Check FFmpeg installation): {e}", file=sys.stderr)
            return wav_path

    def record(self, duration_seconds=None, compress_to_mp3=True):
        """
        Executes the recording lifecycle.
        
        :param duration_seconds: If provided (int/float), records for that long. If None, records indefinitely until Ctrl+C.
        :param compress_to_mp3: If True, exports to MP3. If False, keeps the raw WAV file.
        :return: Path to the generated audio file.
        """
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        temp_wav_filename = os.path.join(self.output_dir, f"recording_{timestamp}.wav")

        self.stream, active_subsystem = self._get_resilient_stream()
        self.is_recording = True
        
        print("\n" + "="*50)
        print(f"🔴 MIC CAPTURE ENGAGED [{active_subsystem}]")
        print(f"Format Target: {'MP3' if compress_to_mp3 else 'WAV'}")
        if duration_seconds:
            print(f"Mode: Timed ({duration_seconds} seconds)")
        else:
            print("Mode: Indefinite (Press Ctrl+C to save and stop)")
        print("="*50 + "\n")

        # Clear any stale queue elements
        while not self.audio_queue.empty():
            self.audio_queue.get()

        try:
            with sf.SoundFile(temp_wav_filename, mode='x', samplerate=self.sample_rate, 
                              channels=self.channels, subtype='PCM_16') as file:
                with self.stream:
                    start_time = time.time()
                    while self.is_recording:
                        # Non-blocking check for timed recordings
                        if duration_seconds and (time.time() - start_time) >= duration_seconds:
                            break
                        
                        try:
                            # Use timeout to avoid locking the loop indefinitely
                            data = self.audio_queue.get(timeout=0.1)
                            file.write(data)
                        except queue.Empty:
                            continue

        except KeyboardInterrupt:
            print("\nCapture interrupted manually by user/agent.")
        finally:
            self.is_recording = False
            if self.stream:
                self.stream.close()

        # Handle formatting logic post-stream closure
        if compress_to_mp3:
            final_path = self._compress_to_mp3(temp_wav_filename)
        else:
            final_path = temp_wav_filename

        print(f"🎉 Process finished. Output file path: {final_path}\n")
        return final_path

# CLI Execution block
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Resilient Cross-Platform Mic Recorder Subsystem")
    parser.add_argument("--dir", type=str, default="./recordings", help="Target output folder")
    parser.add_argument("--duration", type=int, default=None, help="Recording time limit in seconds")
    parser.add_argument("--wav", action="store_true", help="Force raw WAV output (skips MP3 encoding)")
    
    args = parser.parse_args()
    
    recorder = ResilientMicRecorder(output_dir=args.dir)
    # If --wav flag is passed, compress_to_mp3 becomes False
    recorder.record(duration_seconds=args.duration, compress_to_mp3=not args.wav)