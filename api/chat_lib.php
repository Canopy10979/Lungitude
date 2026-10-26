<?php

/* Validate bounded LungBot text conversations and enforce paid-request limits. */
function lungbot_messages(array $input): array
{
    if (($input['consent'] ?? false) !== true) {
        throw new InvalidArgumentException('Confirm the chat privacy notice before sending.');
    }
    $messages = $input['messages'] ?? null;
    if (!is_array($messages) || !array_is_list($messages) || count($messages) < 1 || count($messages) > 9) {
        throw new InvalidArgumentException('Send between one and nine conversation messages.');
    }
    $clean = [];
    $totalBytes = 0;
    foreach ($messages as $index => $message) {
        $expectedRole = $index % 2 === 0 ? 'user' : 'assistant';
        if (!is_array($message) || ($message['role'] ?? '') !== $expectedRole) {
            throw new InvalidArgumentException('Conversation messages must alternate user and assistant.');
        }
        $content = $message['content'] ?? null;
        if (!is_string($content) || preg_match('//u', $content) !== 1) {
            throw new InvalidArgumentException('Messages must contain valid text.');
        }
        $content = trim($content);
        if ($content === '' || strlen($content) > 5000) {
            throw new InvalidArgumentException('Each message must contain between 1 and 5000 bytes of text.');
        }
        if ($expectedRole === 'user' && strlen($content) > 2000) {
            throw new InvalidArgumentException('Keep your question below 2000 bytes.');
        }
        $totalBytes += strlen($content);
        if ($totalBytes > 12000) {
            throw new InvalidArgumentException('Conversation is too long. Clear chat and start again.');
        }
        $clean[] = ['role' => $expectedRole, 'content' => $content];
    }
    if ($clean[count($clean) - 1]['role'] !== 'user') {
        throw new InvalidArgumentException('The last message must be your question.');
    }
    return $clean;
}

function lungbot_origin_allowed(string $origin, string $host): bool
{
    $parts = parse_url($origin);
    if (!is_array($parts) || !in_array($parts['scheme'] ?? '', ['http', 'https'], true)) {
        return false;
    }
    $authority = strtolower($parts['host'] ?? '');
    if (isset($parts['port'])) {
        $authority .= ':' . $parts['port'];
    }
    return $authority !== '' && hash_equals(strtolower($host), $authority);
}

function lungbot_rate_allowed(PDO $database, string $ip, string $secret): bool
{
    $now = time();
    $minute = intdiv($now, 60);
    $hour = intdiv($now, 3600);
    $visitor = substr(hash_hmac('sha256', $ip, $secret), 0, 24);
    $limits = [
        ['lungbot:minute:' . $minute . ':' . $visitor, 5, $now + 120],
        ['lungbot:hour:' . $hour . ':' . $visitor, 20, $now + 7200],
        ['lungbot:global:' . $hour, 100, $now + 7200],
    ];
    $database->beginTransaction();
    try {
        $database->prepare('DELETE FROM hits WHERE expires <= ?')->execute([$now]);
        foreach ($limits as [$bucket, $limit, $expires]) {
            $statement = $database->prepare('SELECT n FROM hits WHERE bucket = ?');
            $statement->execute([$bucket]);
            if ((int)$statement->fetchColumn() >= $limit) {
                $database->rollBack();
                return false;
            }
        }
        foreach ($limits as [$bucket, $limit, $expires]) {
            $database->prepare('INSERT INTO hits (bucket, n, expires) VALUES (?, 1, ?)
                ON CONFLICT(bucket) DO UPDATE SET n = n + 1')->execute([$bucket, $expires]);
        }
        $database->commit();
        return true;
    } catch (Throwable $error) {
        if ($database->inTransaction()) {
            $database->rollBack();
        }
        throw $error;
    }
}
