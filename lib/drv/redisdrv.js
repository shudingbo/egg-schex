'use strict';

const ioredis = require('ioredis');

/**
 * Redis config manager module
 * @param {object} opt json 对象
 */
let RedisDrv = function( opt, sc ){
	this.redis = null;
	this._cb = null;
	this.sc = sc;
	this.logger = sc.logger;
	this.timerChk = null;
	this.timerChkInterval = 5000;
	this.cfgUpdateTime = {};  /// 记录各个job的更新时间
	this.cfg = opt;
	this.upJobs = [];   //! 要更新的Job列表
	this.jobCfgs = {};  //! 各个任务的配置文件

	if( opt.checkInterval !== undefined ){
		this.timerChkInterval = opt.checkInterval;
	}

	this.keyChk = opt.keyPre + ":updateTime";
	this.keyJobs = opt.keyPre + ":jobs";
	this.keyStatus = opt.keyPre + ":status";
	this.keyCfg = opt.keyPre + ":cfg";
}


/**
 * Start Monitor the schedule job's change.
 * 
 * @param  {Function} cb when schedule change,will trigger call this CB.
 * @return {[type]}      [description]
 */
RedisDrv.prototype.start_monitor = function(cb){
	this._cb = cb;
	connectRedis( this );
};


RedisDrv.prototype.stop_monitor = function(){
	disconnectRedis( this );
};


/**
 * Update Job Status
 * @param  {int} handleType @see const.js STA.
 * @param  {object} job  job object
 * @return null
 */
RedisDrv.prototype.update_Job = function( handleType, job){
	let self = this;

	let cfg = {
		status : job.status,
		latestHandleType: handleType,
		latestHandleTime: Math.floor(Date.now()/1000),
		startTime: job.startTime,
		stopTime: job.stopTime,
		latestRunTime: job.latestRunTime,
		nextRunTime: job.nextRunTime,
		msg: job.msg,

	};

	if( job.parent !== undefined && job.parent !== null ){
		cfg.parent = job.parent.name;
	}

	self.redis.hset( self.keyStatus, job.name, JSON.stringify( cfg) );
};

/** Update Job's msg 
 * @param jobName Job's Name
 * @param msg  Update msg
 */
RedisDrv.prototype.update_msg = function( jobName, msg )
{
	let self = this;

	self.redis.hget( self.keyStatus, jobName,function(err,reply){
		//self.logger.info('-- get config',err,reply );
		if( err === null && reply !== null ){
			let cfg = JSON.parse(reply);
			cfg.msg = msg;
			//self.logger.info('-- get Status', cfg );
			self.redis.hset( self.keyStatus, jobName, JSON.stringify( cfg) );
		}
	});
};



RedisDrv.prototype.getConfig = function( jobName ){
	//this.logger.info( this.jobCfgs  );
	if( this.jobCfgs[ jobName ] !== undefined )
	{
		return this.jobCfgs[jobName];
	}

	return {};
};


RedisDrv.prototype.removeJob = function( jobName ){
	let self = this;
	self.redis.hdel( self.keyStatus, jobName );
};


function cfgChange( self ){
	let upJobs = self.upJobs.slice(0);
	self.upJobs = [];

	let len = upJobs.length;
	for( let i=0; i<len; i++){
		getCfgFromDB( self, upJobs[i]);
	}
}

function getCfgFromDB( self, jobName ){
	self.redis.hget( self.keyJobs, jobName,function( err, reply){
		if( err === null && reply !== null ){
			let schedules = {};
			schedules[ jobName ] = JSON.parse( reply );

			/// 加载配置文件
			self.redis.hget( self.keyCfg, jobName,function(err,reply){
				if( err === null && reply !== null ){
					self.jobCfgs[ jobName ] = JSON.parse(reply);
					if( self._cb !== null ){
						self._cb( schedules );
					}
				}
			});
		}
	});
}

function initData( self ){
	self.logger.info("[schex-ag] Connect to redis.");

	if( self.timerChk != null ){
		clearInterval( self.timerChk );
	}

	(async ()=>{
		try{
			await initUpdateTime( self );
			self.timerChk = setInterval( function(){
				checkCfg( self );
			}, self.timerChkInterval );	
		}catch(err){
			self.logger.warn('[schex-ag] initUpdateTime: ', err);
		}
	})();
}

function connectRedis( self ){
	self.redis = new ioredis( {
		host:self.cfg.host,
		port:self.cfg.port,
		db:self.cfg.db
	} );

	self.redis.on("error",function( err ){
		self.logger.warn("[schex-ag] Error " + err);

	});

	self.redis.on("connect",function( err ){
		if( !err ){
			initData(self);
		}
	});	
}

async function initUpdateTime( self ){
		let replySta = await self.redis.hgetall( self.keyStatus );

		for( let sta in replySta  ){
			let t = JSON.parse(replySta[sta]);
			if( t.parent !== undefined ){
				self.redis.hdel( self.keyStatus, sta );
			}
		}

		///
		let pipe = self.redis.pipeline();
		pipe.hgetall( self.keyCfg );
		pipe.hgetall( self.keyJobs );
		pipe.hgetall( self.keyChk );
		let rets = await pipe.exec();

		let jobCfgs = {};
		let jobs = {};
		let jobChks = {};
		if(rets[0][0] === null){
			jobCfgs = rets[0][1];
		}

		if(rets[1][0] === null){
			jobs = rets[1][1];
		}

		if(rets[2][0] === null){
			jobChks = rets[2][1];
		}

		/// 初始化 Job
		let curTM = Math.floor( Date.now() /1000);
		let pipeUp = self.redis.pipeline();
		let jobInfos = {};
		for( let jobName in jobs ){
			let jobInfo = JSON.parse( jobs[jobName] );
			let cfg = {};
			if( jobCfgs[ jobName ] !== undefined){
				cfg = JSON.parse( jobCfgs[jobName] );
			}

			self.jobCfgs[ jobName ] = cfg;

			if( jobChks[jobName] !== undefined ){
				self.cfgUpdateTime[ jobName ] = parseInt(jobChks[jobName]);
			}else{
				pipeUp.hset( self.keyChk, jobName, curTM);
				self.cfgUpdateTime[ jobName ] = curTM;
			}
			
			jobInfos[jobName] = jobInfo;
		}

		await pipeUp.exec();
		if( self._cb !== null ){
			self._cb( jobInfos );
		}
}


function disconnectRedis( self ){
	if( self.timerChk !== null ){
		clearInterval( self.timerChk );
	}

	if( self.cfg.instanse === undefined ){
		self.redis.quit();
	}
	self.logger.info("[schex-ag] DisConnect from redis.");
}


function checkCfg( self ){
	self.redis.hgetall( self.keyChk,function( err, reply){
		if( err === null && reply !== null ){
			for( let sc in reply ){
				if( reply[sc] != self.cfgUpdateTime[sc] ){
					self.logger.info( `[schex-ag] job cfg [${sc}] has change.`);
					
					self.upJobs.push( sc );
					self.cfgUpdateTime[sc] = reply[sc];
				}
			}
			
			cfgChange(self);
		}
	});
}

//
module.exports = function(opt,sc){
	return new RedisDrv( opt,sc );
};

