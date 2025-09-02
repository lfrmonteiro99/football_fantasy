<?php

namespace MatchSimulator\Models;

class BallPosition
{
    public float $x;
    public float $y;
    public float $speed;
    public float $direction;
    public string $status;
    
    public function __construct(float $x, float $y, float $speed, float $direction, string $status)
    {
        $this->x = $x;
        $this->y = $y;
        $this->speed = $speed;
        $this->direction = $direction;
        $this->status = $status;
    }
} 