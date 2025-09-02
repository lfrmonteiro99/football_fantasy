import { MatchContext, PlayerPosition, MatchEvent } from '../../types';

/**
 * ROBUST DESIGN E: Comprehensive Diagnostic Logging System
 * 
 * Provides detailed logging for debugging interception loops, rapid-fire events,
 * and other simulation issues. Logs player positions, action timers, and contest details
 * whenever critical events occur.
 */
export class DiagnosticLogger {
  
  private static logs: DiagnosticLog[] = [];
  private static maxLogs = 1000; // Keep last 1000 log entries
  private static debugMode = true; // Enable/disable detailed logging
  
  /**
   * Log an interception event with full context
   */
  static logInterception(
    interceptor: PlayerPosition,
    passer: PlayerPosition,
    target: PlayerPosition | null,
    context: MatchContext,
    success: boolean
  ): void {
    if (!this.debugMode) return;
    
    const log: DiagnosticLog = {
      timestamp: context.tick,
      minute: context.currentMinute,
      type: 'interception',
      event: {
        interceptorId: interceptor.playerId,
        interceptorName: this.getPlayerName(interceptor.playerId, context),
        passerId: passer.playerId,
        passerName: this.getPlayerName(passer.playerId, context),
        targetId: target?.playerId,
        targetName: target ? this.getPlayerName(target.playerId, context) : 'None',
        success: success,
        ballPosition: { ...context.ballPosition },
        playerPositions: this.capturePlayerPositions([interceptor, passer, target].filter(Boolean) as PlayerPosition[]),
        actionTimers: this.captureActionTimers([interceptor, passer, target].filter(Boolean) as PlayerPosition[]),
        previousEvents: this.getRecentEvents(context, 5)
      }
    };
    
    this.addLog(log);
    
    console.log(`🛡️ DIAGNOSTIC: INTERCEPTION - ${log.event.interceptorName} ${success ? 'SUCCESS' : 'FAILED'} vs ${log.event.passerName} → ${log.event.targetName || 'None'}`);
    console.log(`   Ball: (${context.ballPosition.x.toFixed(1)}, ${context.ballPosition.y.toFixed(1)})`);
    console.log(`   Interceptor: (${interceptor.x.toFixed(1)}, ${interceptor.y.toFixed(1)}) - ${interceptor.currentAction || 'idle'} - Timer: ${interceptor.actionTimer}`);
    console.log(`   Passer: (${passer.x.toFixed(1)}, ${passer.y.toFixed(1)}) - ${passer.currentAction || 'idle'} - Timer: ${passer.actionTimer}`);
    if (target) {
      console.log(`   Target: (${target.x.toFixed(1)}, ${target.y.toFixed(1)}) - ${target.currentAction || 'idle'} - Timer: ${target.actionTimer}`);
    }
  }
  
  /**
   * Log a rapid-fire event detection (same players repeatedly)
   */
  static logRapidFireEvent(
    player1: PlayerPosition,
    player2: PlayerPosition,
    eventType: string,
    context: MatchContext,
    consecutiveCount: number
  ): void {
    if (!this.debugMode) return;
    
    const log: DiagnosticLog = {
      timestamp: context.tick,
      minute: context.currentMinute,
      type: 'rapid_fire',
      event: {
        player1Id: player1.playerId,
        player1Name: this.getPlayerName(player1.playerId, context),
        player2Id: player2.playerId,
        player2Name: this.getPlayerName(player2.playerId, context),
        eventType: eventType,
        consecutiveCount: consecutiveCount,
        ballPosition: { ...context.ballPosition },
        playerPositions: this.capturePlayerPositions([player1, player2]),
        actionTimers: this.captureActionTimers([player1, player2]),
        cooldowns: this.captureCooldowns([player1, player2]),
        previousEvents: this.getRecentEvents(context, 10)
      }
    };
    
    this.addLog(log);
    
    console.log(`🔥 DIAGNOSTIC: RAPID FIRE DETECTED - ${eventType} between ${log.event.player1Name} and ${log.event.player2Name} (${consecutiveCount} times)`);
    console.log(`   Ball: (${context.ballPosition.x.toFixed(1)}, ${context.ballPosition.y.toFixed(1)})`);
    console.log(`   ${log.event.player1Name}: (${player1.x.toFixed(1)}, ${player1.y.toFixed(1)}) - Action: ${player1.currentAction || 'idle'} - Timer: ${player1.actionTimer}`);
    console.log(`   ${log.event.player2Name}: (${player2.x.toFixed(1)}, ${player2.y.toFixed(1)}) - Action: ${player2.currentAction || 'idle'} - Timer: ${player2.actionTimer}`);
    console.log(`   Last 5 events: ${this.getRecentEvents(context, 5).map(e => e.type).join(' → ')}`);
  }
  
  /**
   * Log a possession change with context
   */
  static logPossessionChange(
    oldPossession: any,
    newPossession: any,
    reason: string,
    context: MatchContext
  ): void {
    if (!this.debugMode) return;
    
    const oldPlayer = oldPossession.playerId ? context.playerPositions.get(oldPossession.playerId) : null;
    const newPlayer = newPossession.playerId ? context.playerPositions.get(newPossession.playerId) : null;
    
    const log: DiagnosticLog = {
      timestamp: context.tick,
      minute: context.currentMinute,
      type: 'possession_change',
      event: {
        oldTeam: oldPossession.team,
        newTeam: newPossession.team,
        oldPlayerId: oldPossession.playerId,
        newPlayerId: newPossession.playerId,
        oldPlayerName: oldPlayer ? this.getPlayerName(oldPlayer.playerId, context) : 'None',
        newPlayerName: newPlayer ? this.getPlayerName(newPlayer.playerId, context) : 'None',
        reason: reason,
        ballPosition: { ...context.ballPosition },
        playerPositions: this.capturePlayerPositions([oldPlayer, newPlayer].filter(Boolean) as PlayerPosition[]),
        actionTimers: this.captureActionTimers([oldPlayer, newPlayer].filter(Boolean) as PlayerPosition[])
      }
    };
    
    this.addLog(log);
    
    console.log(`⚡ DIAGNOSTIC: POSSESSION CHANGE - ${oldPossession.team} (${log.event.oldPlayerName || 'None'}) → ${newPossession.team} (${log.event.newPlayerName || 'None'}) [${reason}]`);
  }
  
  /**
   * Log a ball contest resolution
   */
  static logBallContest(
    contestType: string,
    participants: PlayerPosition[],
    winner: PlayerPosition | null,
    ballPosition: any,
    context: MatchContext,
    additionalData?: any
  ): void {
    if (!this.debugMode) return;
    
    const log: DiagnosticLog = {
      timestamp: context.tick,
      minute: context.currentMinute,
      type: 'ball_contest',
      event: {
        contestType: contestType,
        participantIds: participants.map(p => p.playerId),
        participantNames: participants.map(p => this.getPlayerName(p.playerId, context)),
        winnerId: winner?.playerId,
        winnerName: winner ? this.getPlayerName(winner.playerId, context) : 'None',
        ballPosition: { ...ballPosition },
        playerPositions: this.capturePlayerPositions(participants),
        actionTimers: this.captureActionTimers(participants),
        additionalData: additionalData
      }
    };
    
    this.addLog(log);
    
    const participantList = log.event.participantNames.join(' vs ');
    console.log(`⚔️ DIAGNOSTIC: BALL CONTEST - ${contestType.toUpperCase()} between ${participantList}`);
    console.log(`   Winner: ${log.event.winnerName || 'None'}`);
    console.log(`   Ball: (${ballPosition.x.toFixed(1)}, ${ballPosition.y.toFixed(1)})`);
    
    participants.forEach((participant, index) => {
      console.log(`   ${log.event.participantNames[index]}: (${participant.x.toFixed(1)}, ${participant.y.toFixed(1)}) - ${participant.currentAction || 'idle'} - Timer: ${participant.actionTimer}`);
    });
  }
  
  /**
   * Log action state changes for debugging
   */
  static logActionStateChange(
    player: PlayerPosition,
    oldAction: string | undefined,
    newAction: string | undefined,
    context: MatchContext
  ): void {
    if (!this.debugMode) return;
    
    const log: DiagnosticLog = {
      timestamp: context.tick,
      minute: context.currentMinute,
      type: 'action_state',
      event: {
        playerId: player.playerId,
        playerName: this.getPlayerName(player.playerId, context),
        oldAction: oldAction || 'none',
        newAction: newAction || 'none',
        actionTimer: player.actionTimer,
        actionState: player.actionState ? { ...player.actionState } : null,
        cooldowns: player.actionCooldowns ? { ...player.actionCooldowns } : {},
        playerPosition: { x: player.x, y: player.y, speed: player.speed, direction: player.direction }
      }
    };
    
    this.addLog(log);
    
    if (oldAction !== newAction) {
      console.log(`🎬 DIAGNOSTIC: ACTION CHANGE - ${log.event.playerName}: ${oldAction || 'none'} → ${newAction || 'none'} (Timer: ${player.actionTimer})`);
    }
  }
  
  /**
   * Log physics-related issues (teleporting, impossible speeds, etc.)
   */
  static logPhysicsAnomaly(
    player: PlayerPosition,
    anomalyType: string,
    details: any,
    context: MatchContext
  ): void {
    if (!this.debugMode) return;
    
    const log: DiagnosticLog = {
      timestamp: context.tick,
      minute: context.currentMinute,
      type: 'physics_anomaly',
      event: {
        playerId: player.playerId,
        playerName: this.getPlayerName(player.playerId, context),
        anomalyType: anomalyType,
        details: details,
        playerPosition: { x: player.x, y: player.y, speed: player.speed, direction: player.direction },
        ballPosition: { ...context.ballPosition }
      }
    };
    
    this.addLog(log);
    
    console.log(`⚠️ DIAGNOSTIC: PHYSICS ANOMALY - ${log.event.playerName}: ${anomalyType}`);
    console.log(`   Details: ${JSON.stringify(details)}`);
    console.log(`   Position: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}) Speed: ${player.speed.toFixed(1)}`);
  }
  
  /**
   * Log cooldown violations or timer issues
   */
  static logTimingIssue(
    player: PlayerPosition,
    issueType: string,
    expectedValue: number,
    actualValue: number,
    context: MatchContext
  ): void {
    if (!this.debugMode) return;
    
    const log: DiagnosticLog = {
      timestamp: context.tick,
      minute: context.currentMinute,
      type: 'timing_issue',
      event: {
        playerId: player.playerId,
        playerName: this.getPlayerName(player.playerId, context),
        issueType: issueType,
        expectedValue: expectedValue,
        actualValue: actualValue,
        actionTimer: player.actionTimer,
        currentAction: player.currentAction,
        cooldowns: player.actionCooldowns ? { ...player.actionCooldowns } : {}
      }
    };
    
    this.addLog(log);
    
    console.log(`⏰ DIAGNOSTIC: TIMING ISSUE - ${log.event.playerName}: ${issueType}`);
    console.log(`   Expected: ${expectedValue}, Actual: ${actualValue}`);
    console.log(`   Current Action: ${player.currentAction || 'none'}, Timer: ${player.actionTimer}`);
  }
  
  /**
   * Analyze logs for patterns and potential issues
   */
  static analyzeLogs(): DiagnosticAnalysis {
    const recentLogs = this.logs.slice(-100); // Analyze last 100 logs
    
    const analysis: DiagnosticAnalysis = {
      totalLogs: this.logs.length,
      recentLogs: recentLogs.length,
      rapidFireEvents: 0,
      interceptionLoops: 0,
      possessionPingPong: 0,
      physicsAnomalies: 0,
      timingIssues: 0,
      commonPlayers: {},
      patterns: []
    };
    
    // Count event types
    for (const log of recentLogs) {
      switch (log.type) {
        case 'rapid_fire':
          analysis.rapidFireEvents++;
          break;
        case 'physics_anomaly':
          analysis.physicsAnomalies++;
          break;
        case 'timing_issue':
          analysis.timingIssues++;
          break;
      }
      
      // Track common players in events
      if (log.event.playerId) {
        const playerId = log.event.playerId;
        analysis.commonPlayers[playerId] = (analysis.commonPlayers[playerId] || 0) + 1;
      }
    }
    
    // Detect interception loops
    analysis.interceptionLoops = this.detectInterceptionLoops(recentLogs);
    
    // Detect possession ping-pong
    analysis.possessionPingPong = this.detectPossessionPingPong(recentLogs);
    
    // Generate patterns
    analysis.patterns = this.identifyPatterns(recentLogs);
    
    return analysis;
  }
  
  /**
   * Export logs to file for external analysis
   */
  static exportLogs(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      totalLogs: this.logs.length,
      logs: this.logs.slice(-500), // Export last 500 logs
      analysis: this.analyzeLogs()
    }, null, 2);
  }
  
  /**
   * Clear old logs to prevent memory issues
   */
  static clearOldLogs(): void {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
      console.log(`🧹 DIAGNOSTIC: Cleared old logs, keeping ${this.maxLogs} most recent`);
    }
  }
  
  /**
   * Enable or disable debug mode
   */
  static setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    console.log(`🔧 DIAGNOSTIC: Debug mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }
  
  // PRIVATE HELPER METHODS
  
  private static addLog(log: DiagnosticLog): void {
    this.logs.push(log);
    this.clearOldLogs();
  }
  
  private static getPlayerName(playerId: number, context: MatchContext): string {
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const player = allPlayers.find(p => p.id === playerId);
    return player ? `${player.first_name} ${player.last_name}` : `Player ${playerId}`;
  }
  
  private static capturePlayerPositions(players: PlayerPosition[]): Record<number, any> {
    const positions: Record<number, any> = {};
    
    for (const player of players) {
      positions[player.playerId] = {
        x: player.x,
        y: player.y,
        speed: player.speed,
        direction: player.direction,
        action: player.action,
        team: player.team,
        role: player.role
      };
    }
    
    return positions;
  }
  
  private static captureActionTimers(players: PlayerPosition[]): Record<number, any> {
    const timers: Record<number, any> = {};
    
    for (const player of players) {
      timers[player.playerId] = {
        actionTimer: player.actionTimer,
        currentAction: player.currentAction,
        actionState: player.actionState ? { ...player.actionState } : null,
        lastActionTick: player.lastActionTick
      };
    }
    
    return timers;
  }
  
  private static captureCooldowns(players: PlayerPosition[]): Record<number, any> {
    const cooldowns: Record<number, any> = {};
    
    for (const player of players) {
      cooldowns[player.playerId] = player.actionCooldowns ? { ...player.actionCooldowns } : {};
    }
    
    return cooldowns;
  }
  
  private static getRecentEvents(context: MatchContext, count: number): MatchEvent[] {
    return context.matchEvents.slice(-count);
  }
  
  private static detectInterceptionLoops(logs: DiagnosticLog[]): number {
    let loops = 0;
    const interceptionLogs = logs.filter(log => log.type === 'interception');
    
    // Look for same players intercepting each other repeatedly
    for (let i = 0; i < interceptionLogs.length - 2; i++) {
      const log1 = interceptionLogs[i];
      const log2 = interceptionLogs[i + 1];
      const log3 = interceptionLogs[i + 2];
      
      if (log1.event.interceptorId === log3.event.passerId &&
          log1.event.passerId === log3.event.interceptorId &&
          log2.event.interceptorId === log1.event.passerId) {
        loops++;
      }
    }
    
    return loops;
  }
  
  private static detectPossessionPingPong(logs: DiagnosticLog[]): number {
    let pingPongs = 0;
    const possessionLogs = logs.filter(log => log.type === 'possession_change');
    
    // Look for rapid possession changes between same teams
    for (let i = 0; i < possessionLogs.length - 3; i++) {
      const changes = possessionLogs.slice(i, i + 4);
      const teams = changes.map(log => log.event.newTeam);
      
      if (teams[0] === teams[2] && teams[1] === teams[3] && teams[0] !== teams[1]) {
        pingPongs++;
      }
    }
    
    return pingPongs;
  }
  
  private static identifyPatterns(logs: DiagnosticLog[]): string[] {
    const patterns: string[] = [];
    
    // Pattern 1: High frequency of same event type
    const eventCounts: Record<string, number> = {};
    for (const log of logs) {
      eventCounts[log.type] = (eventCounts[log.type] || 0) + 1;
    }
    
    for (const [eventType, count] of Object.entries(eventCounts)) {
      if (count > 10) {
        patterns.push(`High frequency of ${eventType} events (${count} occurrences)`);
      }
    }
    
    // Pattern 2: Same players involved in multiple events
    const playerInvolvement: Record<number, number> = {};
    for (const log of logs) {
      if (log.event.playerId) {
        playerInvolvement[log.event.playerId] = (playerInvolvement[log.event.playerId] || 0) + 1;
      }
    }
    
    for (const [playerId, count] of Object.entries(playerInvolvement)) {
      if (count > 15) {
        patterns.push(`Player ${playerId} involved in ${count} logged events`);
      }
    }
    
    // Pattern 3: Time clustering of events
    const timeWindows: Record<number, number> = {};
    for (const log of logs) {
      const window = Math.floor(log.timestamp / 10); // 10-tick windows
      timeWindows[window] = (timeWindows[window] || 0) + 1;
    }
    
    for (const [window, count] of Object.entries(timeWindows)) {
      if (count > 5) {
        patterns.push(`Event clustering in ticks ${parseInt(window) * 10}-${(parseInt(window) + 1) * 10} (${count} events)`);
      }
    }
    
    return patterns;
  }
}

// TYPE DEFINITIONS

interface DiagnosticLog {
  timestamp: number;
  minute: number;
  type: 'interception' | 'rapid_fire' | 'possession_change' | 'ball_contest' | 'action_state' | 'physics_anomaly' | 'timing_issue';
  event: any;
}

interface DiagnosticAnalysis {
  totalLogs: number;
  recentLogs: number;
  rapidFireEvents: number;
  interceptionLoops: number;
  possessionPingPong: number;
  physicsAnomalies: number;
  timingIssues: number;
  commonPlayers: Record<number, number>;
  patterns: string[];
}