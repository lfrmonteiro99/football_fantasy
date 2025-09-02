import { MatchContext, PlayerPosition, PlayerActionState, PlayerPhysicalState } from '../../types';

/**
 * ROBUST DESIGN B: Action Timers and States Per Player
 * 
 * Manages player action states, timers, and prevents instant action switching.
 * Players that are mid-action cannot instantly start new actions until their timer completes.
 */
export class ActionStateManager {
  
  /**
   * Initialize action states for all players
   */
  static initializePlayerActionStates(context: MatchContext): void {
    context.activeActions = new Map();
    context.actionQueue = new Map();
    context.contestHistory = [];
    
    // Initialize action states for all players
    for (const [playerId, player] of context.playerPositions) {
      player.actionState = this.createDefaultActionState();
      player.physicalState = this.createDefaultPhysicalState(player, context);
      player.intentTarget = undefined;
      player.queuedAction = undefined;
    }
    
    console.log(`🎮 ACTION STATE MANAGER: Initialized states for ${context.playerPositions.size} players`);
  }
  
  /**
   * Update all player action states each tick
   */
  static updateActionStates(context: MatchContext): void {
    for (const [playerId, player] of context.playerPositions) {
      this.updatePlayerActionState(player, context);
      this.updatePlayerPhysicalState(player, context);
      this.processActionQueue(player, context);
    }
    
    // Clean up old contest history
    this.cleanupContestHistory(context);
  }
  
  /**
   * Check if a player can start a new action
   */
  static canPlayerStartAction(player: PlayerPosition, actionType: string, context: MatchContext): boolean {
    const state = player.actionState;
    
    // Player must be idle or have an interruptible action
    if (state.current === 'executing' && !state.canInterrupt) {
      console.log(`🚫 ACTION BLOCKED: Player ${player.playerId} is executing non-interruptible action`);
      return false;
    }
    
    // Check action cooldowns
    const cooldown = player.actionCooldowns?.[actionType] || 0;
    if (cooldown > 0) {
      console.log(`⏰ ACTION COOLDOWN: Player ${player.playerId} has ${cooldown} ticks cooldown for ${actionType}`);
      return false;
    }
    
    // Check physical state limitations
    if (!this.canPhysicallyPerformAction(player, actionType)) {
      console.log(`💪 PHYSICAL LIMITATION: Player ${player.playerId} cannot physically perform ${actionType}`);
      return false;
    }
    
    // Check if action conflicts with current action
    if (this.actionsConflict(state.current === 'executing' ? player.currentAction : undefined, actionType)) {
      console.log(`⚔️ ACTION CONFLICT: Player ${player.playerId} - ${player.currentAction} conflicts with ${actionType}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Start a new action for a player
   */
  static startPlayerAction(
    player: PlayerPosition, 
    actionType: string, 
    target: any, 
    duration: number, 
    context: MatchContext
  ): boolean {
    
    if (!this.canPlayerStartAction(player, actionType, context)) {
      // Try to queue the action if possible
      this.queuePlayerAction(player, actionType, context);
      return false;
    }
    
    // Interrupt current action if necessary
    if (player.actionState.current === 'executing') {
      this.interruptPlayerAction(player, context);
    }
    
    // Set up new action
    player.currentAction = actionType;
    player.actionTimer = duration;
    player.actionStartTick = context.tick;
    player.intentTarget = target;
    
    // Update action state
    player.actionState = {
      current: 'preparing',
      phase: 0,
      canInterrupt: this.getActionInterruptibility(actionType),
      priority: this.getActionPriority(actionType),
      target: target
    };
    
    // Store in active actions
    context.activeActions?.set(player.playerId, player.actionState);
    
    console.log(`🎬 ACTION START: Player ${player.playerId} starts ${actionType} (duration: ${duration} ticks)`);
    
    return true;
  }
  
  /**
   * Complete a player action
   */
  static completePlayerAction(player: PlayerPosition, context: MatchContext): void {
    const actionType = player.currentAction;
    
    if (!actionType) return;
    
    // Set recovery state
    player.actionState = {
      current: 'recovering',
      phase: 0,
      canInterrupt: true,
      priority: 0,
      target: undefined
    };
    
    // Apply action cooldown
    if (!player.actionCooldowns) player.actionCooldowns = {};
    player.actionCooldowns[actionType] = this.getActionCooldown(actionType);
    
    // Update physical state
    this.applyActionPhysicalEffects(player, actionType);
    
    console.log(`✅ ACTION COMPLETE: Player ${player.playerId} completed ${actionType}`);
    
    // Clear action data
    player.currentAction = undefined;
    player.actionTimer = 0;
    player.intentTarget = undefined;
    
    // Remove from active actions
    context.activeActions?.delete(player.playerId);
  }
  
  /**
   * Queue an action for later execution
   */
  private static queuePlayerAction(player: PlayerPosition, actionType: string, context: MatchContext): void {
    if (!context.actionQueue) context.actionQueue = new Map();
    
    let queue = context.actionQueue.get(player.playerId) || [];
    
    // Limit queue size to prevent infinite queuing
    if (queue.length < 2) {
      queue.push(actionType);
      context.actionQueue.set(player.playerId, queue);
      console.log(`📋 ACTION QUEUED: Player ${player.playerId} queued ${actionType}`);
    }
  }
  
  /**
   * Process queued actions for a player
   */
  private static processActionQueue(player: PlayerPosition, context: MatchContext): void {
    if (!context.actionQueue || player.actionState.current !== 'idle') return;
    
    const queue = context.actionQueue.get(player.playerId);
    if (!queue || queue.length === 0) return;
    
    const nextAction = queue.shift()!;
    if (this.canPlayerStartAction(player, nextAction, context)) {
      // Start the queued action
      const duration = this.getActionDuration(nextAction);
      this.startPlayerAction(player, nextAction, undefined, duration, context);
    }
    
    // Update queue
    if (queue.length === 0) {
      context.actionQueue.delete(player.playerId);
    } else {
      context.actionQueue.set(player.playerId, queue);
    }
  }
  
  /**
   * Interrupt a player's current action
   */
  private static interruptPlayerAction(player: PlayerPosition, context: MatchContext): void {
    const actionType = player.currentAction;
    
    if (!actionType || !player.actionState.canInterrupt) return;
    
    console.log(`⚠️ ACTION INTERRUPTED: Player ${player.playerId} - ${actionType} interrupted`);
    
    // Apply interruption penalty
    this.applyInterruptionPenalty(player, actionType);
    
    // Clear current action
    player.currentAction = undefined;
    player.actionTimer = 0;
    player.intentTarget = undefined;
    
    // Set to recovering state
    player.actionState = {
      current: 'recovering',
      phase: 0,
      canInterrupt: true,
      priority: 0,
      target: undefined
    };
  }
  
  /**
   * Update individual player action state
   */
  private static updatePlayerActionState(player: PlayerPosition, context: MatchContext): void {
    const state = player.actionState;
    
    switch (state.current) {
      case 'preparing':
        // Preparation phase - build up to action
        state.phase += 20; // Preparation takes ~5 ticks
        if (state.phase >= 100) {
          state.current = 'executing';
          state.phase = 0;
        }
        break;
        
      case 'executing':
        // Execution phase - action is happening
        if (player.actionTimer > 0) {
          const totalDuration = this.getActionDuration(player.currentAction || 'hold');
          state.phase = ((totalDuration - player.actionTimer) / totalDuration) * 100;
        } else {
          // Action completed
          this.completePlayerAction(player, context);
        }
        break;
        
      case 'recovering':
        // Recovery phase - cooldown after action
        state.phase += 25; // Recovery takes ~4 ticks
        if (state.phase >= 100) {
          state.current = 'idle';
          state.phase = 0;
        }
        break;
        
      case 'contested':
        // Player is in a contest - managed by CentralContestResolver
        // This state is set externally
        break;
        
      case 'idle':
      default:
        // Player is idle and can start new actions
        state.phase = 0;
        break;
    }
  }
  
  /**
   * Update player physical state
   */
  private static updatePlayerPhysicalState(player: PlayerPosition, context: MatchContext): void {
    const physical = player.physicalState;
    
    // Update fatigue from global system
    physical.fatigue = context.fatigueLevels[player.playerId.toString()] || 0;
    
    // Recover balance gradually
    physical.balance = Math.min(1, physical.balance + 0.1);
    
    // Decay momentum
    physical.momentum.x *= 0.9;
    physical.momentum.y *= 0.9;
    
    // Recover from previous actions
    physical.recovery = Math.max(0, physical.recovery - 1);
    
    // Update stamina based on action intensity
    if (player.currentAction) {
      const intensity = this.getActionIntensity(player.currentAction);
      physical.stamina = Math.max(0, physical.stamina - intensity);
    } else {
      // Gradual stamina recovery when idle
      physical.stamina = Math.min(100, physical.stamina + 0.5);
    }
  }
  
  /**
   * Check if player can physically perform an action
   */
  private static canPhysicallyPerformAction(player: PlayerPosition, actionType: string): boolean {
    const physical = player.physicalState;
    
    // Check stamina requirements
    const staminaRequired = this.getActionStaminaRequirement(actionType);
    if (physical.stamina < staminaRequired) {
      return false;
    }
    
    // Check balance requirements
    const balanceRequired = this.getActionBalanceRequirement(actionType);
    if (physical.balance < balanceRequired) {
      return false;
    }
    
    // Check if still recovering from previous action
    if (physical.recovery > 0) {
      return false;
    }
    
    return true;
  }
  
  // HELPER METHODS
  
  private static createDefaultActionState(): PlayerActionState {
    return {
      current: 'idle',
      phase: 0,
      canInterrupt: true,
      priority: 0,
      target: undefined
    };
  }
  
  private static createDefaultPhysicalState(player: PlayerPosition, context: MatchContext): PlayerPhysicalState {
    return {
      fatigue: context.fatigueLevels[player.playerId.toString()] || 0,
      balance: 1,
      momentum: { x: 0, y: 0 },
      recovery: 0,
      stamina: 100
    };
  }
  
  private static getActionInterruptibility(actionType: string): boolean {
    const nonInterruptibleActions = ['shooting', 'tackling', 'header'];
    return !nonInterruptibleActions.includes(actionType);
  }
  
  private static getActionPriority(actionType: string): number {
    const priorities: Record<string, number> = {
      'shooting': 10,
      'tackling': 8,
      'header': 7,
      'pass': 5,
      'dribbling': 4,
      'running': 2,
      'positioning': 1
    };
    return priorities[actionType] || 3;
  }
  
  private static getActionDuration(actionType: string): number {
    const durations: Record<string, number> = {
      'dribble': 3,
      'pass': 2,
      'shot': 4,
      'shooting': 4,
      'hold': 1,
      'tackle': 2,
      'tackling': 2,
      'cross': 2,
      'positioning': 1,
      'running': 1,
      'header': 3
    };
    return durations[actionType] || 2;
  }
  
  private static getActionCooldown(actionType: string): number {
    const cooldowns: Record<string, number> = {
      'pass': 2,
      'shooting': 5,
      'tackling': 4,
      'dribbling': 2,
      'header': 3
    };
    return cooldowns[actionType] || 1;
  }
  
  private static actionsConflict(currentAction: string | undefined, newAction: string): boolean {
    if (!currentAction) return false;
    
    // Define conflicting action pairs
    const conflicts: Record<string, string[]> = {
      'shooting': ['passing', 'dribbling', 'tackling'],
      'passing': ['shooting', 'tackling'],
      'tackling': ['shooting', 'passing', 'dribbling'],
      'dribbling': ['shooting', 'tackling']
    };
    
    return conflicts[currentAction]?.includes(newAction) || false;
  }
  
  private static applyActionPhysicalEffects(player: PlayerPosition, actionType: string): void {
    const physical = player.physicalState;
    
    // Apply specific effects based on action type
    switch (actionType) {
      case 'tackling':
        physical.balance -= 0.3;
        physical.recovery = 3;
        break;
      case 'shooting':
        physical.balance -= 0.2;
        physical.recovery = 2;
        break;
      case 'sprinting':
        physical.recovery = 1;
        break;
    }
    
    // Apply momentum based on action
    if (actionType === 'running' || actionType === 'sprinting') {
      const direction = player.direction;
      physical.momentum.x += Math.cos(direction) * 2;
      physical.momentum.y += Math.sin(direction) * 2;
    }
  }
  
  private static applyInterruptionPenalty(player: PlayerPosition, actionType: string): void {
    if (!player.actionCooldowns) player.actionCooldowns = {};
    
    // Apply longer cooldown for interrupted actions
    const baseCooldown = this.getActionCooldown(actionType);
    player.actionCooldowns[actionType] = Math.ceil(baseCooldown * 1.5);
    
    // Apply physical penalty
    player.physicalState.balance -= 0.1;
    player.physicalState.recovery = 2;
  }
  
  private static getActionIntensity(actionType: string): number {
    const intensities: Record<string, number> = {
      'sprinting': 3,
      'tackling': 2.5,
      'shooting': 2,
      'running': 1.5,
      'dribbling': 1,
      'passing': 0.5,
      'positioning': 0.2
    };
    return intensities[actionType] || 1;
  }
  
  private static getActionStaminaRequirement(actionType: string): number {
    const requirements: Record<string, number> = {
      'sprinting': 20,
      'tackling': 15,
      'shooting': 10,
      'running': 8,
      'dribbling': 5,
      'passing': 3,
      'positioning': 1
    };
    return requirements[actionType] || 5;
  }
  
  private static getActionBalanceRequirement(actionType: string): number {
    const requirements: Record<string, number> = {
      'shooting': 0.8,
      'tackling': 0.7,
      'passing': 0.6,
      'dribbling': 0.5,
      'running': 0.3,
      'positioning': 0.1
    };
    return requirements[actionType] || 0.4;
  }
  
  private static cleanupContestHistory(context: MatchContext): void {
    if (!context.contestHistory) return;
    
    // Keep only last 50 contest records
    const maxRecords = 50;
    if (context.contestHistory.length > maxRecords) {
      context.contestHistory = context.contestHistory.slice(-maxRecords);
    }
  }
}