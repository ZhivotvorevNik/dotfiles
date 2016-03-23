# some more ls aliases
alias ll='ls -alFh'
alias la='ls -AFh'
alias l='ls -CFh'
alias ..='cd ..'
alias ...='cd ../../'

# git aliases
alias gl='git log --pretty=oneline --graph'
alias gs='git status'
alias gp='git pull'
alias gb='git branch'
alias gd='git diff'
alias gm='git merge'
alias gch='git checkout'
alias gcm='git commit -m'
alias gcam='git commit -am'
alias gph='git push origin'

# ssh alias
alias v25='ssh -4 v25.wdevx.yandex.net'


# enable color support of ls and also add handy aliases
if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias ls='ls --color=auto'
    #alias dir='dir --color=auto'
    #alias vdir='vdir --color=auto'

    alias grep='grep --color=auto'
    alias fgrep='fgrep --color=auto'
    alias egrep='egrep --color=auto'
fi
