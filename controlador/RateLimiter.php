<?php

class RateLimiter {
    private $filePath;
    private $maxAttempts = 5;
    private $timeWindow = 600; // 10 minutes in seconds

    public function __construct() {
        $this->filePath = __DIR__ . '/rate_limits.json';
    }

    /**
     * Checks if the IP is allowed to proceed.
     * Returns true if allowed, false if blocked.
     */
    public function check($ip) {
        $data = $this->loadData();
        $this->cleanup($data);

        if (isset($data[$ip])) {
            if ($data[$ip]['attempts'] >= $this->maxAttempts) {
                // Check if blockage time is still active
                $firstAttemptTime = $data[$ip]['first_attempt'];
                if (time() - $firstAttemptTime < $this->timeWindow) {
                    return false;
                } else {
                    // Window passed, reset
                    unset($data[$ip]);
                    $this->saveData($data);
                    return true;
                }
            }
        }
        return true;
    }

    /**
     * Records a failed attempt for the IP.
     */
    public function recordFailure($ip) {
        $data = $this->loadData();
        
        if (!isset($data[$ip])) {
            $data[$ip] = [
                'attempts' => 1,
                'first_attempt' => time()
            ];
        } else {
            $data[$ip]['attempts']++;
            // If window expired but we are recording a failure, strictly we might want to reset,
            // but the check() should have handled expiration.
            // If check() wasn't called or allowed it (because window expired), 
            // we should probably reset if the previous first_attempt is too old.
            if (time() - $data[$ip]['first_attempt'] > $this->timeWindow) {
                 $data[$ip] = [
                    'attempts' => 1,
                    'first_attempt' => time()
                ];
            }
        }
        
        $this->saveData($data);
    }

    private function loadData() {
        if (!file_exists($this->filePath)) {
            return [];
        }
        $content = @file_get_contents($this->filePath);
        if (!$content) return [];
        $data = json_decode($content, true);
        return is_array($data) ? $data : [];
    }

    private function saveData($data) {
        @file_put_contents($this->filePath, json_encode($data));
    }

    private function cleanup(&$data) {
        $changed = false;
        foreach ($data as $ip => $info) {
             if (time() - $info['first_attempt'] > $this->timeWindow) {
                unset($data[$ip]);
                $changed = true;
             }
        }
        if ($changed) {
            $this->saveData($data);
        }
    }
}
?>
